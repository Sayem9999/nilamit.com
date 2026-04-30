import { db, newId, snapDocs } from '@/lib/db';
import { PlaceBidResult, Alert } from '@/types';
import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendOutbidEmail as firebaseSendOutbidEmail } from '@/lib/firebase-email';
import { sendOutbidAlert } from '@/lib/fcm';
import { ERROR_CODES } from '@/lib/constants';
import { checkAndAwardBadges } from '@/actions/gamification';
import { detectShillBidding } from '@/lib/moderation';
import { log } from '@/lib/logger';
import { validateBidPreconditions, computeAntiSnipeExtension } from './bid-rules';

interface BidSideEffectParams {
  bidId: string;
  newEndTime: Date;
  antiSnipeTriggered: boolean;
  prevBidderId: string | null;
  auctionTitle: string;
  auctionStartTime: Date;
  triggeredAlerts: Alert[];
  sellerId: string;
}

export class BiddingService {
  /**
   * Execute an atomic bid transaction.
   *
   * Correctness notes:
   *   - All values used for validation MUST come from `tx.get(aRef)`. Firestore
   *     transactions only lock document reads via `tx.get`; collection queries
   *     (`.where(...).get()`) inside a transaction are NOT transactional, so
   *     concurrent bids would each read the same "previous" state and both win.
   *   - The previous top bidder (used for outbid notifications) is therefore
   *     denormalised onto the auction document as `currentBidderId`, so we can
   *     read it transactionally.
   *   - Pre-existing alerts for the auction are also fetched OUTSIDE the
   *     transaction (after commit) — they're advisory, not authoritative, and
   *     querying them inside the transaction would expose the same race.
   */
  static async placeBid(auctionId: string, amount: number, userId: string, userName: string, userEmail: string): Promise<PlaceBidResult> {
    return log.time('BiddingService.placeBid', async () => {
      const aRef = db.collection('auctions').doc(auctionId);

      const txResult = await db.runTransaction(async (tx) => {
        const aSnap = await tx.get(aRef);
        if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

        const auction = aSnap.data()!;
        const now     = new Date();
        const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);

        // Validate against the transactionally-locked currentPrice. Two
        // concurrent bids cannot both pass this check — one will retry.
        validateBidPreconditions({
          auctionStatus:   auction.status,
          endTime,
          sellerId:        auction.sellerId,
          bidderId:        userId,
          currentPrice:    auction.currentPrice,
          startingPrice:   auction.startingPrice,
          minBidIncrement: auction.minBidIncrement,
          amount,
          now,
        });

        // Previous top bidder is read from the auction doc itself (locked by tx).
        const prevBidderId: string | null = auction.currentBidderId ?? null;

        // Create bid
        const bidId  = newId();
        const bidRef = db.collection('bids').doc(bidId);
        tx.set(bidRef, { id: bidId, amount, auctionId, bidderId: userId, createdAt: now });

        // Anti-sniping extends from the current `endTime` (not `now`) so a
        // bidder cannot SHORTEN the auction by bidding early in the soft-close window.
        const { newEndTime, triggered: antiSnipeTriggered } = computeAntiSnipeExtension({ endTime, now });

        tx.update(aRef, {
          currentPrice:    amount,
          currentBidderId: userId,                                 // denormalised for the next bid's tx read
          endTime:         newEndTime,
          wasExtended:     antiSnipeTriggered ? true : auction.wasExtended,
          bidCount:        (auction.bidCount ?? 0) + 1,
          updatedAt:       now,
        });

        return {
          bidId,
          newEndTime,
          antiSnipeTriggered,
          prevBidderId,
          auctionTitle:    auction.title,
          auctionStartTime: auction.startTime?.toDate ? auction.startTime.toDate() : new Date(auction.startTime),
          sellerId:        auction.sellerId,
        };
      });

      // Alerts are fetched + deactivated AFTER the bid commits. They're
      // notification triggers, not authoritative state, so a small window
      // between commit and alert update is acceptable. Keeping them out of
      // the transaction means we don't reintroduce a non-transactional query.
      const triggeredAlerts = await this.processAlertsAfterBid(auctionId, userId, amount);

      const result: BidSideEffectParams = {
        ...txResult,
        triggeredAlerts,
      };

      // Fire-and-forget side effects — must not block the bid response
      this.handleBidSideEffects(result, auctionId, userId, userName, userEmail, amount).catch(
        (e) => log.error('[BiddingService] handleBidSideEffects uncaught', e, { auctionId, userId })
      );

      return {
        success: true,
        bid: { id: result.bidId, amount, auctionId, bidderId: userId, createdAt: new Date() },
        newEndTime: result.newEndTime,
        antiSnipeTriggered: result.antiSnipeTriggered,
      };
    }, { auctionId, userId, amount });
  }

  /**
   * Find active alerts for an auction that should fire because of `amount`.
   * Deactivates any TARGET_REACHED alerts that triggered. Runs OUTSIDE the
   * bid transaction — it is advisory, not authoritative state.
   */
  private static async processAlertsAfterBid(
    auctionId: string,
    bidderId: string,
    amount: number,
  ): Promise<Alert[]> {
    const alertsSnap = await db.collection('alerts')
      .where('auctionId', '==', auctionId)
      .where('isActive', '==', true)
      .get();

    const alerts = snapDocs<Alert>(alertsSnap);
    const triggered = alerts.filter((a) =>
      a.userId !== bidderId &&
      (a.type === 'OUTBID' || (a.type === 'TARGET_REACHED' && (a.thresholdPrice ?? 0) <= amount))
    );

    const targetReached = triggered.filter((a) => a.type === 'TARGET_REACHED');
    if (targetReached.length > 0) {
      const batch = db.batch();
      for (const a of targetReached) {
        batch.update(db.collection('alerts').doc(a.id), { isActive: false });
      }
      await batch.commit();
    }

    return triggered;
  }

  /**
   * Handle all post-bid triggers like emails, push, and RTDB updates
   */
  private static async handleBidSideEffects(result: BidSideEffectParams, auctionId: string, userId: string, userName: string, userEmail: string, amount: number) {
    // 1. Fetch prev bidder email
    let prevBidderEmail: string | null = null;
    if (result.prevBidderId && result.prevBidderId !== userId) {
      const pbSnap = await db.collection('users').doc(result.prevBidderId).get();
      prevBidderEmail = pbSnap.data()?.email ?? null;
    }

    // 2. Notifications
    if (prevBidderEmail && prevBidderEmail !== userEmail) {
      firebaseSendOutbidEmail(prevBidderEmail, result.auctionTitle, amount, auctionId).catch((e) => log.error('bidding: outbid email failed', e, { auctionId }));
    }

    if (result.triggeredAlerts.length > 0) {
      Promise.all(result.triggeredAlerts.map((alert: Alert) =>
        rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
          event: FIREBASE_EVENTS.PRICE_ALERT, auctionId,
          auctionTitle: result.auctionTitle, amount, type: alert.type, threshold: alert.thresholdPrice,
        })
      )).catch((e) => log.error('bidding: price alert notifications failed', e, { auctionId }));
    }

    if (result.prevBidderId && result.prevBidderId !== userId) {
      rtdbPush(RTDB_PATHS.userNotifications(result.prevBidderId), {
        event: FIREBASE_EVENTS.OUTBID_ALERT, auctionId,
        auctionTitle: result.auctionTitle, amount, newBidderName: userName ?? null,
      }).catch((e) => log.error('bidding: outbid RTDB notification failed', e, { auctionId }));

      sendOutbidAlert(result.prevBidderId, result.auctionTitle, amount).catch((e) => log.error('bidding: outbid FCM push failed', e, { auctionId }));
    }

    // 3. RTDB State
    rtdbSet(RTDB_PATHS.auctionBid(auctionId), {
      event: FIREBASE_EVENTS.NEW_BID, amount,
      endTime: result.newEndTime.toISOString(), bidderName: userName ?? 'Someone',
    }).catch((e) => log.error('bidding: auction bid RTDB set failed', e, { auctionId }));

    rtdbPush(RTDB_PATHS.auctionActivity(auctionId), {
      event: FIREBASE_EVENTS.NEW_BID, amount, bidderName: userName ?? 'Someone',
    }).catch((e) => log.error('bidding: auction activity push failed', e, { auctionId }));

    // 4. Async background tasks
    checkAndAwardBadges(userId, auctionId, amount, result.antiSnipeTriggered, result.auctionStartTime).catch((e) => log.error('bidding: badge check failed', e, { auctionId, userId }));
    detectShillBidding(auctionId, userId, result.sellerId, amount).catch((e) => log.error('bidding: shill detection failed', e, { auctionId, userId }));
  }

  static async getAuctionBids(auctionId: string) {
    const snap = await db.collection('bids')
      .where('auctionId', '==', auctionId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const bidderIds = [...new Set(snap.docs.map(d => d.data().bidderId as string))];
    let biddersMap = new Map<string, { id: string; name: string | null; image: string | null }>();
    
    if (bidderIds.length > 0) {
      const bidderRefs = bidderIds.map(id => db.collection('users').doc(id));
      const bidderSnaps = await db.getAll(...bidderRefs);
      biddersMap = new Map(bidderSnaps.map(s => [s.id, { id: s.id, name: s.data()?.name ?? null, image: s.data()?.image ?? null }]));
    }

    return snap.docs.map((d) => {
      const b = d.data() as { amount: number; auctionId: string; bidderId: string; createdAt: { toDate?: () => Date } | Date };
      const createdAt = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.() ?? new Date();
      return {
        id: d.id,
        amount: b.amount,
        auctionId: b.auctionId,
        bidderId: b.bidderId,
        createdAt,
        bidder: biddersMap.get(b.bidderId) ?? { id: b.bidderId, name: null as string | null, image: null as string | null },
      };
    });
  }
}
