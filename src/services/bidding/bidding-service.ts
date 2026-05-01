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
import { processAuctionSale, sendSaleNotifications } from '@/lib/auction-logic';

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const auction: any = aSnap.data()!;
        const now     = new Date();
        const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
        const increment = auction.minBidIncrement ?? 10;

        validateBidPreconditions({
          auctionStatus:   auction.status,
          endTime,
          startTime:       auction.startTime,
          sellerId:        auction.sellerId,
          bidderId:        userId,
          currentPrice:    auction.currentPrice,
          startingPrice:   auction.startingPrice,
          minBidIncrement: increment,
          amount,
          now,
        });

        const prevBidderId: string | null = auction.currentBidderId ?? null;
        const existingProxy = auction.proxyMaxBid ?? 0;
        const existingProxyBidder = auction.proxyBidderId ?? null;

        let newCurrentPrice = auction.currentPrice;
        let newCurrentBidderId = auction.currentBidderId;
        let newProxyMaxBid = auction.proxyMaxBid ?? 0;
        let newProxyBidderId = auction.proxyBidderId ?? null;

        // ─── PROXY BIDDING LOGIC ───
        if (!newCurrentBidderId) {
          // First bid ever
          newCurrentPrice = auction.startingPrice;
          newCurrentBidderId = userId;
          newProxyMaxBid = amount;
          newProxyBidderId = userId;
        } else if (userId === existingProxyBidder) {
          // Current leader is topping up their own proxy
          if (amount > existingProxy) {
            newProxyMaxBid = amount;
          } else {
            throw new Error('You already have a higher or equal max bid.');
          }
        } else {
          // Competitive bidding
          if (amount > existingProxy) {
            // New bidder overtakes the old proxy
            newCurrentPrice = Math.min(amount, existingProxy + increment);
            newCurrentBidderId = userId;
            newProxyMaxBid = amount;
            newProxyBidderId = userId;
          } else {
            // New bidder fails to overtake the old proxy
            newCurrentPrice = Math.min(existingProxy, amount + increment);
            // newCurrentBidderId remains the existingProxyBidder
            newCurrentBidderId = existingProxyBidder;
            // newProxyMaxBid remains the same
          }
        }

        // ─── RESERVE PRICE CHECK ───
        const isReserveMet = auction.reservePrice ? newCurrentPrice >= auction.reservePrice : true;

        // Create bid record (audit trail)
        const bidId  = newId();
        const bidRef = db.collection('bids').doc(bidId);
        tx.set(bidRef, { id: bidId, amount, auctionId, bidderId: userId, createdAt: now, isProxy: true });

        // Anti-sniping
        const { newEndTime, triggered: antiSnipeTriggered } = computeAntiSnipeExtension({ endTime, now });

        tx.update(aRef, {
          currentPrice:    newCurrentPrice,
          currentBidderId: newCurrentBidderId,
          proxyMaxBid:     newProxyMaxBid,
          proxyBidderId:   newProxyBidderId,
          isReserveMet,
          endTime:         newEndTime,
          wasExtended:     antiSnipeTriggered ? true : (auction.wasExtended || false),
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

      // Fire-and-forget side effects — must not block the bid response
      this.handleBidSideEffects(txResult, auctionId, userId, userName, userEmail, amount).catch(
        (e) => log.error('[BiddingService] handleBidSideEffects uncaught', e, { auctionId, userId })
      );

      return {
        success: true,
        bid: { id: txResult.bidId, amount, auctionId, bidderId: userId, createdAt: new Date() },
        newEndTime: txResult.newEndTime,
        antiSnipeTriggered: txResult.antiSnipeTriggered,
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
  private static async handleBidSideEffects(txResult: Omit<BidSideEffectParams, 'triggeredAlerts'>, auctionId: string, userId: string, userName: string, userEmail: string, amount: number) {
    // Alerts are fetched + deactivated OUTSIDE the critical path
    const triggeredAlerts = await this.processAlertsAfterBid(auctionId, userId, amount);
    const result: BidSideEffectParams = { ...txResult, triggeredAlerts };

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

    // Global Activity Ticker
    rtdbPush(RTDB_PATHS.globalActivity(), {
      event: FIREBASE_EVENTS.NEW_BID, 
      amount, 
      bidderName: userName ?? 'Someone',
      auctionTitle: result.auctionTitle,
      auctionId,
      timestamp: Date.now()
    }).catch((e) => log.error('bidding: global ticker push failed', e));

    // 4. Async background tasks
    checkAndAwardBadges(userId, auctionId, amount, result.antiSnipeTriggered, result.auctionStartTime).catch((e) => log.error('bidding: badge check failed', e, { auctionId, userId }));
    detectShillBidding(auctionId, userId, result.sellerId, amount).catch((e) => log.error('bidding: shill detection failed', e, { auctionId, userId }));
  }

  /**
   * Atomic BIN purchase: closes auction and initiates escrow.
   */
  static async executeBuyItNow(auctionId: string, userId: string, userName: string, userEmail: string | null): Promise<void> {
    const notifyPayload = await db.runTransaction(async (tx) => {
      const aRef = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);

      const now = new Date();
      const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
      
      if (now < new Date(auction.startTime || 0)) throw new Error('AUCTION_NOT_STARTED');
      if (now >= endTime) throw new Error(ERROR_CODES.AUCTION_ENDED);
      if (auction.sellerId === userId) throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);
      if (!auction.buyItNowPrice) throw new Error('BUY_IT_NOW_NOT_AVAILABLE');

      const sellerSnap = await tx.get(db.collection('users').doc(auction.sellerId));
      const sellerData = sellerSnap.data() || {};

      return processAuctionSale(
        tx,
        {
          id: auctionId,
          title: auction.title,
          sellerId: auction.sellerId,
          deliveryCharge: auction.deliveryCharge,
          reservePrice: auction.reservePrice,
        },
        { id: auction.sellerId, isVerifiedSeller: sellerData.isVerifiedSeller ?? false },
        {
          id:    userId,
          email: userEmail,
          name:  userName,
        },
        auction.buyItNowPrice,
      );
    });

    if (notifyPayload) sendSaleNotifications(notifyPayload);
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
