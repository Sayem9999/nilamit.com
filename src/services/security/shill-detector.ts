import { db } from '@/lib/db';
import { Auction, Bid } from '@/types';
import { log } from '@/lib/logger';

export class ShillDetectorService {
  /**
   * Background Shill Bidding and Fraud Pattern Monitor.
   * Runs asynchronously post-bid placement to protect auction integrity without adding latency.
   */
  static async detectShillBidding(auction: Auction, bid: Bid): Promise<{ isShill: boolean; score: number }> {
    try {
      const bidderId = bid.bidderId;
      const sellerId = auction.sellerId;
      const auctionId = auction.id;
      const ip = bid.ip;
      const userAgent = bid.userAgent;

      let score = 0;
      const reasons: string[] = [];

      // 1. IP/Device Overlaps with Seller
      const sellerSnap = await db.collection('users').doc(sellerId).get();
      if (sellerSnap.exists) {
        const sellerData = sellerSnap.data()!;
        if (ip && sellerData.lastActiveIp === ip && ip !== '127.0.0.1' && ip !== '::1') {
          score += 0.6;
          reasons.push(`Bidder IP (${ip}) matches Seller's last active IP`);
        }
        if (userAgent && sellerData.lastActiveUserAgent === userAgent && userAgent !== 'unknown') {
          score += 0.4;
          reasons.push(`Bidder User-Agent matches Seller's last active User-Agent`);
        }
      }

      // 2. Co-Bidding (Ring Bidding / Same IP/Device Bid War)
      const recentBidsSnap = await db.collection('bids')
        .where('auctionId', '==', auctionId)
        .orderBy('amount', 'desc')
        .limit(10)
        .get();

      const recentBids = recentBidsSnap.docs.map(doc => doc.data() as Bid);
      
      const differentBiddersSameIp = recentBids.filter(b => 
        b.bidderId !== bidderId && 
        b.ip === ip && 
        ip && ip !== '127.0.0.1' && ip !== '::1'
      );
      if (differentBiddersSameIp.length > 0) {
        score += 0.5;
        reasons.push(`Co-bidding detected: ${differentBiddersSameIp.length} other bidder(s) placed bids using the same IP (${ip})`);
      }

      const differentBiddersSameUA = recentBids.filter(b =>
        b.bidderId !== bidderId &&
        b.userAgent === userAgent &&
        userAgent && userAgent !== 'unknown'
      );
      if (differentBiddersSameUA.length > 0) {
        score += 0.3;
        reasons.push(`Device signature overlap: ${differentBiddersSameUA.length} other bidder(s) placed bids using the same User-Agent`);
      }

      // 3. Repeat Bid War / Non-paying bidder pattern on same seller
      const sellerAuctionsSnap = await db.collection('auctions')
        .where('sellerId', '==', sellerId)
        .limit(20)
        .get();
      
      const sellerAuctionIds = sellerAuctionsSnap.docs.map(doc => doc.id);
      if (sellerAuctionIds.length > 0) {
        const bidderBidsSnap = await db.collection('bids')
          .where('bidderId', '==', bidderId)
          .limit(50)
          .get();
        
        const bidderBids = bidderBidsSnap.docs.map(doc => doc.data() as Bid);
        const bidsOnSellerAuctions = bidderBids.filter(b => sellerAuctionIds.includes(b.auctionId));
        const uniqueAuctionsBidOn = new Set(bidsOnSellerAuctions.map(b => b.auctionId));
        
        if (uniqueAuctionsBidOn.size >= 3) {
          const salesSnap = await db.collection('escrowTransactions')
            .where('buyerId', '==', bidderId)
            .where('sellerId', '==', sellerId)
            .where('status', '==', 'RELEASED')
            .get();
          
          if (salesSnap.empty) {
            score += 0.5;
            reasons.push(`Bidder bid on ${uniqueAuctionsBidOn.size} auctions by this seller, but has 0 completed paid purchases.`);
          }
        }
      }

      const finalScore = Math.min(1.0, score);
      const isShill = finalScore >= 0.7;

      if (isShill) {
        log.warn('[ShillDetector] High confidence shill bidding detected!', {
          auctionId, bidderId, sellerId, score: finalScore, reasons
        });

        // 1. Log automated report for admin review
        const reportId = `shill_${auctionId}_${bid.id}`;
        const reportRef = db.collection('reports').doc(reportId);
        const now = new Date();
        const description = `Automated fraud prevention engine flagged high-confidence shill bidding. Confidence Score: ${finalScore.toFixed(2)}. Reasons: ${reasons.join('; ')}`;
        
        await reportRef.set({
          id: reportId,
          auctionId,
          reporterId: 'system',
          reason: 'SHILL_BIDDING',
          description,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });

        // 2. Programmatically deduct seller trust rating and increment defectCount
        await db.runTransaction(async (tx) => {
          const sellerRef = db.collection('users').doc(sellerId);
          const sSnap = await tx.get(sellerRef);
          if (sSnap.exists) {
            const sData = sSnap.data()!;
            const currentRating = sData.rating ?? 5.0;
            const currentDefectCount = sData.defectCount ?? 0;

            tx.update(sellerRef, {
              rating: Math.max(1.0, currentRating - 1.0),
              defectCount: currentDefectCount + 1,
              updatedAt: now,
            });
          }
        });
      }

      return { isShill, score: finalScore };
    } catch (error) {
      log.error('[ShillDetector] detectShillBidding failed', error, { auctionId: auction.id, bidId: bid.id });
      return { isShill: false, score: 0 };
    }
  }
}
