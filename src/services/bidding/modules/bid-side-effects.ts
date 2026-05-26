import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { ShillDetectorService } from '@/services/security/shill-detector';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { Auction, Bid } from '@/types';
import { log } from '@/lib/logger';
import { db } from '@/lib/db';
import { scheduleAuctionClosure } from '@/lib/cloud-tasks';

export class BidSideEffects {
  /**
   * Orchestrates post-bid notifications and real-time updates.
   * Designed to be resilient: failures in non-critical tasks won't block the bid.
   */
  static async handleBidSideEffects(auction: Auction, bid: Bid, prevBidderId: string | null, newEndTime?: Date): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    // Asynchronously audit bid for potential shill bidding fraud patterns
    tasks.push(ShillDetectorService.detectShillBidding(auction, bid).catch(e => 
      log.error('[BidSideEffects] Shill Bidding detection failed', e, { auctionId: auction.id, bidId: bid.id })
    ));

    // Fetch bidder name for real-time feed
    let bidderName = 'Someone';
    try {
      const bidderSnap = await db.collection('users').doc(bid.bidderId).get();
      if (bidderSnap.exists) {
        bidderName = bidderSnap.data()?.name ?? 'Someone';
      }
    } catch (e) {
      log.error('[BidSideEffects] Failed to fetch bidder name', e);
    }

    const bidAmount = bid.publicAmount ?? bid.amount;

    // 1. RTDB Update for current auction view (overwrite with single flat node)
    tasks.push(rtdbSet(RTDB_PATHS.auctionBid(auction.id), {
      event: FIREBASE_EVENTS.NEW_BID,
      amount: bidAmount,
      bidderId: bid.bidderId,
      bidderName,
      bidCount: (auction.bidCount || 0) + 1,
      endTime: newEndTime ? newEndTime.toISOString() : auction.endTime.toISOString(),
      createdAt: new Date().toISOString(),
    }).catch(e => log.error('[BidSideEffects] RTDB update failed', e)));

    // 1.5. RTDB Update for global live ticker
    tasks.push(rtdbPush(RTDB_PATHS.globalActivity(), {
      event: FIREBASE_EVENTS.NEW_BID,
      amount: bidAmount,
      bidderName,
      auctionTitle: auction.title,
      auctionId: auction.id,
      timestamp: Date.now(),
    }).catch(e => log.error('[BidSideEffects] Global RTDB feed update failed', e)));

    // 2. Outbid Notification
    if (prevBidderId && prevBidderId !== bid.bidderId) {
      tasks.push(this.notifyOutbid(prevBidderId, auction, bidAmount));
    }

    // 3. Seller Notification
    tasks.push(this.notifySeller(auction.sellerId, auction, bidAmount));

    // 4. Cloud Task Rescheduling (Event-driven closure)
    // If the end time has been extended (e.g. anti-sniping), we must schedule a new task.
    if (newEndTime && newEndTime.getTime() !== auction.endTime.getTime()) {
      tasks.push(scheduleAuctionClosure(auction.id, newEndTime).catch(e => 
        log.error('[BidSideEffects] Failed to reschedule closure task', e, { auctionId: auction.id })
      ));
    }

    await Promise.allSettled(tasks);
  }

  private static async notifyOutbid(userId: string, auction: Auction, newAmount: number): Promise<void> {
    try {
      await rtdbPush(RTDB_PATHS.userNotifications(userId), {
        event: FIREBASE_EVENTS.OUTBID_ALERT,
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
