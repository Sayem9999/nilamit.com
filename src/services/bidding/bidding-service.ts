import { db, newId, snapDocs } from '@/lib/db';
import { PlaceBidResult, Alert } from '@/types';
import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendOutbidEmail as firebaseSendOutbidEmail } from '@/lib/firebase-email';
import { sendOutbidAlert } from '@/lib/fcm';
import { ERROR_CODES, SOFT_CLOSE_WINDOW_MS, SOFT_CLOSE_EXTENSION_MS } from '@/lib/constants';
import { checkAndAwardBadges } from '@/actions/gamification';
import { detectShillBidding } from '@/lib/moderation';

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
   * Execute an atomic bid transaction
   */
  static async placeBid(auctionId: string, amount: number, userId: string, userName: string, userEmail: string): Promise<PlaceBidResult> {
    const result = await db.runTransaction(async (tx) => {
      const aRef  = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE')    throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      const now     = new Date();
      const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
      if (now >= endTime)                  throw new Error(ERROR_CODES.AUCTION_ENDED);
      if (auction.sellerId === userId)     throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);

      const minRequired = (auction.currentPrice ?? auction.startingPrice) + (auction.minBidIncrement ?? 10);
      if (amount < minRequired) throw new Error(`${ERROR_CODES.BID_TOO_LOW}: ৳${minRequired.toLocaleString()}`);

      // Previous top bid
      const prevBidsSnap = await db.collection('bids')
        .where('auctionId', '==', auctionId)
        .orderBy('amount', 'desc')
        .limit(1)
        .get();
      const prevBid = prevBidsSnap.empty ? null : prevBidsSnap.docs[0].data();

      // Create bid
      const bidId  = newId();
      const bidRef = db.collection('bids').doc(bidId);
      tx.set(bidRef, { id: bidId, amount, auctionId, bidderId: userId, createdAt: now });

      // Anti-sniping
      const timeUntilEnd     = endTime.getTime() - now.getTime();
      let newEndTime         = endTime;
      let antiSnipeTriggered = false;

      if (!auction.wasExtended && timeUntilEnd <= SOFT_CLOSE_WINDOW_MS) {
        newEndTime         = new Date(endTime.getTime() + SOFT_CLOSE_EXTENSION_MS);
        antiSnipeTriggered = true;
      }

      tx.update(aRef, {
        currentPrice: amount,
        endTime:      newEndTime,
        wasExtended:  antiSnipeTriggered ? true : auction.wasExtended,
        bidCount:     (auction.bidCount ?? 0) + 1,
        updatedAt:    now,
      });

      // Active alerts
      const alertsSnap = await db.collection('alerts')
        .where('auctionId', '==', auctionId)
        .where('isActive', '==', true)
        .get();

      const alerts = snapDocs<Alert>(alertsSnap);
      const triggeredAlerts = alerts.filter((a) =>
        a.userId !== userId &&
        (a.type === 'OUTBID' || (a.type === 'TARGET_REACHED' && (a.thresholdPrice ?? 0) <= amount))
      );

      triggeredAlerts
        .filter((a) => a.type === 'TARGET_REACHED')
        .forEach((a) => tx.update(db.collection('alerts').doc(a.id), { isActive: false }));

      return {
        bidId, newEndTime, antiSnipeTriggered,
        prevBidderId:  prevBid?.bidderId ?? null,
        auctionTitle:  auction.title,
        auctionStartTime: auction.startTime?.toDate ? auction.startTime.toDate() : new Date(auction.startTime),
        triggeredAlerts,
        sellerId: auction.sellerId,
      };
    });

    // Trigger Side Effects (Async)
    this.handleBidSideEffects(result, auctionId, userId, userName, userEmail, amount);

    return {
      success: true,
      bid: { id: result.bidId, amount, auctionId, bidderId: userId, createdAt: new Date() },
      newEndTime: result.newEndTime,
      antiSnipeTriggered: result.antiSnipeTriggered,
    };
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
      firebaseSendOutbidEmail(prevBidderEmail, result.auctionTitle, amount, auctionId).catch(console.error);
    }

    if (result.triggeredAlerts.length > 0) {
      Promise.all(result.triggeredAlerts.map((alert: Alert) =>
        rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
          event: FIREBASE_EVENTS.PRICE_ALERT, auctionId,
          auctionTitle: result.auctionTitle, amount, type: alert.type, threshold: alert.thresholdPrice,
        })
      )).catch(console.error);
    }

    if (result.prevBidderId && result.prevBidderId !== userId) {
      rtdbPush(RTDB_PATHS.userNotifications(result.prevBidderId), {
        event: FIREBASE_EVENTS.OUTBID_ALERT, auctionId,
        auctionTitle: result.auctionTitle, amount, newBidderName: userName ?? null,
      }).catch(console.error);

      sendOutbidAlert(result.prevBidderId, result.auctionTitle, amount).catch(console.error);
    }

    // 3. RTDB State
    rtdbSet(RTDB_PATHS.auctionBid(auctionId), {
      event: FIREBASE_EVENTS.NEW_BID, amount,
      endTime: result.newEndTime.toISOString(), bidderName: userName ?? 'Someone',
    }).catch(console.error);

    rtdbPush(RTDB_PATHS.auctionActivity(auctionId), {
      event: FIREBASE_EVENTS.NEW_BID, amount, bidderName: userName ?? 'Someone',
    }).catch(console.error);

    // 4. Async background tasks
    checkAndAwardBadges(userId, auctionId, amount, result.antiSnipeTriggered, result.auctionStartTime).catch(console.error);
    detectShillBidding(auctionId, userId, result.sellerId, amount).catch(console.error);
  }

  static async getAuctionBids(auctionId: string) {
    const snap = await db.collection('bids')
      .where('auctionId', '==', auctionId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const bidderIds = [...new Set(snap.docs.map(d => d.data().bidderId as string))];
    const bidderSnaps = await Promise.all(bidderIds.map(id => db.collection('users').doc(id).get()));
    const biddersMap  = new Map(bidderSnaps.map(s => [s.id, { id: s.id, name: s.data()?.name ?? null, image: s.data()?.image ?? null }]));

    return snap.docs.map(d => {
      const b = d.data();
      return { ...b, id: d.id, createdAt: b.createdAt?.toDate?.() ?? new Date(b.createdAt),
        bidder: biddersMap.get(b.bidderId) ?? { id: b.bidderId, name: null, image: null } };
    });
  }
}
