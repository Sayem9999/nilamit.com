import { db } from '@/lib/db';
import { Bid, Auction, PlaceBidResult, BidWithBidder } from '@/types';
import { ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { BidProcessor } from './modules/bid-processor';
import { BidSideEffects } from './modules/bid-side-effects';
import { ERROR_CODES } from '@/lib/constants';
import { processAuctionSale, sendSaleNotifications } from '@/lib/auction-logic';

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
  static async getAuctionBids(auctionId: string): Promise<BidWithBidder[]> {
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
        } as BidWithBidder;
      });
    } catch (err) {
      log.error('[BiddingService] getAuctionBids failed', err, { auctionId });
      return [];
    }
  }

  /**
   * Atomic BIN purchase: closes auction and initiates escrow.
   */
  static async executeBuyItNow(
    auctionId: string, 
    userId: string, 
    userName: string, 
    userEmail: string | null
  ): Promise<void> {
    const notifyPayload = await db.runTransaction(async (tx) => {
      const aRef = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);

      const now = new Date();
      const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
      if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
        throw new Error(ERROR_CODES.AUCTION_ENDED);
      }

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

  /**
   * Handles non-critical side effects like notifications and RTDB syncing.
   * Delegated to BidSideEffects.
   */
  static async handleBidSideEffects(auction: Auction, bid: Bid, prevBidderId: string | null): Promise<void> {
    return BidSideEffects.handleBidSideEffects(auction, bid, prevBidderId);
  }
}
