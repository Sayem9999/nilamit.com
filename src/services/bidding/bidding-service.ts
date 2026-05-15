import { db } from '@/lib/db';
import { Bid, Auction } from '@/types';
import { ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { BidProcessor, PlaceBidResult } from './modules/bid-processor';
import { BidSideEffects } from './modules/bid-side-effects';

/**
 * BiddingService — Facade for Bidding operations.
 * Modularized for high-concurrency scalability and maintainability.
 */
export class BiddingService {
  /**
   * Orchestrates the bid placement process via the BidProcessor.
   */
  static async placeBid(
    auctionId: string, 
    amount: number, 
    userId: string, 
    _userName: string, 
    _userEmail: string
  ): Promise<ServiceResponse<PlaceBidResult>> {
    void _userName; void _userEmail;
    return BidProcessor.placeBid(auctionId, amount, userId);
  }

  /**
   * Retrieves the bidding history for a specific auction.
   */
  static async getAuctionBids(auctionId: string): Promise<Bid[]> {
    try {
      const snap = await db.collection('bids')
        .where('auctionId', '==', auctionId)
        .orderBy('amount', 'desc')
        .limit(50)
        .get();
      
      const bidderIds = [...new Set(snap.docs.map(d => d.data().bidderId as string))];
      let biddersMap = new Map<string, { id: string; name: string | null; image: string | null }>();
      
      if (bidderIds.length > 0) {
        const bidderRefs = bidderIds.map(id => db.collection('users').doc(id));
        const bidderSnaps = await db.getAll(...bidderRefs);
        biddersMap = new Map(bidderSnaps.map(s => [s.id, { 
          id: s.id, 
          name: s.data()?.name ?? null, 
          image: s.data()?.image ?? null 
        }]));
      }

      return snap.docs.map((d) => {
        const b = d.data() as Record<string, unknown>;
        const createdAt = (b.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(b.createdAt as string | number | Date);
        return {
          id: d.id,
          amount: (b.publicAmount as number) ?? (b.amount as number),
          auctionId: b.auctionId as string,
          bidderId: b.bidderId as string,
          createdAt,
          bidder: biddersMap.get(b.bidderId as string) ?? { id: b.bidderId as string, name: null, image: null },
        } as Bid;
      });
    } catch (err) {
      log.error('[BiddingService] getAuctionBids failed', err, { auctionId });
      return [];
    }
  }

  /**
   * Handles non-critical side effects like notifications and RTDB syncing.
   * Delegated to BidSideEffects.
   */
  static async handleBidSideEffects(auction: Auction, bid: Bid, prevBidderId: string | null): Promise<void> {
    return BidSideEffects.handleBidSideEffects(auction, bid, prevBidderId);
  }
}
