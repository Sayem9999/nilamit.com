import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { Auction, Bid } from '@/types';
import { log } from '@/lib/logger';

export class BidSideEffects {
  /**
   * Orchestrates post-bid notifications and real-time updates.
   * Designed to be resilient: failures in non-critical tasks won't block the bid.
   */
  static async handleBidSideEffects(auction: Auction, bid: Bid, prevBidderId: string | null): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    // 1. RTDB Update for current auction view
    tasks.push(rtdbPush(RTDB_PATHS.auctionBid(auction.id), {
      lastBidAmount: bid.amount,
      lastBidderId: bid.bidderId,
      bidCount: (auction.bidCount || 0) + 1,
      updatedAt: Date.now()
    }).catch(e => log.error('[BidSideEffects] RTDB update failed', e)));

    // 2. Outbid Notification
    if (prevBidderId && prevBidderId !== bid.bidderId) {
      tasks.push(this.notifyOutbid(prevBidderId, auction, bid.amount));
    }

    // 3. Seller Notification
    tasks.push(this.notifySeller(auction.sellerId, auction, bid.amount));

    await Promise.allSettled(tasks);
  }

  private static async notifyOutbid(userId: string, auction: Auction, newAmount: number): Promise<void> {
    try {
      await rtdbPush(RTDB_PATHS.userNotifications(userId), {
        type: FIREBASE_EVENTS.OUTBID_ALERT,
        auctionId: auction.id,
        auctionTitle: auction.title,
        newAmount,
        timestamp: Date.now()
      });
    } catch (e) {
      log.error('[BidSideEffects] Outbid notification failed', e, { userId, auctionId: auction.id });
    }
  }

  private static async notifySeller(sellerId: string, auction: Auction, amount: number): Promise<void> {
    try {
      await rtdbPush(RTDB_PATHS.userNotifications(sellerId), {
        event: FIREBASE_EVENTS.NEW_BID,
        auctionId: auction.id,
        auctionTitle: auction.title,
        amount,
        timestamp: Date.now()
      });
    } catch (e) {
      log.error('[BidSideEffects] Seller notification failed', e, { sellerId, auctionId: auction.id });
    }
  }
}
