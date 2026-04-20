import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { RTDB_PATHS } from '@/lib/firebase-events';
import { rtdbPush } from '@/lib/firebase-admin';

const SUSPICIOUS_THRESHOLDS = {
  SAME_SELLER_BID_RATIO: 0.7, // If 70%+ of bidder's lifetime bids are on this one seller's items
  MIN_TOTAL_BIDS_TO_FLAG: 5,   // Only flag if they have made at least 5 bids total
  ACCOUNT_AGE_HOURS: 24,       // Newly created accounts are suspicious
};

export async function detectShillBidding(auctionId: string, bidderId: string, sellerId: string, amount: number) {
  try {
    // 1. Never flag self-bids here, they are blocked explicitly in bid.ts
    if (bidderId === sellerId) return;

    const bidderSnap = await db.collection('users').doc(bidderId).get();
    if (!bidderSnap.exists) return;
    const bidder = bidderSnap.data()!;

    // 2. Check Account Age
    const createdAt = bidder.createdAt?.toDate ? bidder.createdAt.toDate() : new Date(bidder.createdAt);
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    const isNewAccount = ageHours < SUSPICIOUS_THRESHOLDS.ACCOUNT_AGE_HOURS;

    // 3. Check bidding history ratio
    const allBidsSnap = await db.collection('bids').where('bidderId', '==', bidderId).get();
    const totalBids = allBidsSnap.size;

    if (totalBids >= SUSPICIOUS_THRESHOLDS.MIN_TOTAL_BIDS_TO_FLAG) {
      // Find all unique auctions this user bid on
      const uniqueAuctionIds = [...new Set(allBidsSnap.docs.map(d => d.data().auctionId))];
      
      let bidsOnThisSeller = 0;
      // Fetch seller info for each unique auction
      const chunks = [];
      for (let i = 0; i < uniqueAuctionIds.length; i += 10) {
        chunks.push(uniqueAuctionIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const auctionsSnap = await db.collection('auctions').where('id', 'in', chunk).get();
        auctionsSnap.docs.forEach(doc => {
          if (doc.data().sellerId === sellerId) {
            bidsOnThisSeller++;
          }
        });
      }

      const ratio = bidsOnThisSeller / uniqueAuctionIds.length;

      if (ratio >= SUSPICIOUS_THRESHOLDS.SAME_SELLER_BID_RATIO) {
        // Flag as potential shill bidding
        log.warn('🚨 SHILL BIDDING DETECTED', {
          auctionId,
          bidderId,
          sellerId,
          ratio,
          isNewAccount,
          amount
        });

        // Add to reports collection automatically
        await db.collection('auctionReports').add({
          auctionId,
          reporterId: 'SYSTEM_MODERATOR',
          reason: 'Automated Shill Bidding Detection',
          description: `Bidder has placed ${ratio * 100}% of their lifetime unique auction bids on seller ${sellerId}. Account age: ${ageHours.toFixed(1)}h.`,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Notify admins
        await rtdbPush(RTDB_PATHS.globalActivity(), {
          event: 'admin_alert',
          type: 'SHILL_BIDDING_SUSPICION',
          auctionId,
          bidderId,
          sellerId,
        });
      }
    }
  } catch (error) {
    log.error('Error in detectShillBidding:', error);
  }
}
