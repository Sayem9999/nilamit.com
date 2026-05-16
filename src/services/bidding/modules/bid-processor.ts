import { db, incrementGlobalStat, newId } from '@/lib/db';
import { Auction, Bid, AuctionStatus } from '@/types';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { BidSideEffects } from './bid-side-effects';
import { PlaceBidResult } from '@/types';

export class BidProcessor {
  /**
   * Atomic Transaction for placing a bid with Proxy Bidding support
   */
  static async placeBid(auctionId: string, amount: number, userId: string): Promise<ServiceResponse<PlaceBidResult>> {
    try {
      return await db.runTransaction(async (tx) => {
        const auctionRef = db.collection('auctions').doc(auctionId);
        const auctionSnap = await tx.get(auctionRef);
        
        if (!auctionSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
        const auction = auctionSnap.data() as Auction;

        // 1. Validation
        if (auction.status !== AuctionStatus.ACTIVE) return errorResponse(ErrorType.VALIDATION, 'Auction is not active');
        if (userId === auction.sellerId) return errorResponse(ErrorType.VALIDATION, 'You cannot bid on your own auction');
        
        const increment = auction.minBidIncrement ?? 10;
        if (amount < auction.currentPrice + increment) {
          return errorResponse(ErrorType.VALIDATION, `Bid must be at least ${auction.currentPrice + increment}`);
        }

        const now = new Date();
        const existingProxy = auction.proxyMaxBid ?? 0;
        const existingProxyBidder = auction.proxyBidderId ?? null;

        let newCurrentPrice = auction.currentPrice;
        let newCurrentBidderId = auction.currentBidderId;
        let newProxyMaxBid = auction.proxyMaxBid ?? 0;
        let newProxyBidderId = auction.proxyBidderId ?? null;
        
        let newSecondHighestBidderId = auction.secondHighestBidderId ?? null;
        let newSecondHighestBidAmount = auction.secondHighestBidAmount ?? 0;

        // 2. Proxy Bidding Logic
        if (!newCurrentBidderId) {
          newCurrentPrice = auction.startingPrice;
          newCurrentBidderId = userId;
          newProxyMaxBid = amount;
          newProxyBidderId = userId;
        } else if (userId === existingProxyBidder) {
          if (amount > existingProxy) {
            newProxyMaxBid = amount;
          } else {
            return errorResponse(ErrorType.VALIDATION, 'You already have a higher or equal max bid.');
          }
        } else {
          if (amount > existingProxy) {
            newSecondHighestBidderId = existingProxyBidder;
            newSecondHighestBidAmount = existingProxy;
            newCurrentPrice = Math.min(amount, existingProxy + increment);
            newCurrentBidderId = userId;
            newProxyMaxBid = amount;
            newProxyBidderId = userId;
          } else {
            newSecondHighestBidderId = userId;
            newSecondHighestBidAmount = amount;
            newCurrentPrice = Math.min(existingProxy, amount + increment);
            newCurrentBidderId = existingProxyBidder;
          }
        }

        const bidId = newId();
        const bidRef = db.collection('bids').doc(bidId);

        // 3. Anti-Sniping
        const timeRemaining = auction.endTime.getTime() - now.getTime();
        let newEndTime = auction.endTime;
        let antiSnipeTriggered = false;
        if (timeRemaining < 120000) {
          newEndTime = new Date(now.getTime() + 120000);
          antiSnipeTriggered = true;
        }

        // 4. Update State
        const bid: Bid = {
          id: bidId,
          auctionId,
          bidderId: userId,
          amount,
          publicAmount: newCurrentPrice,
          createdAt: now,
          status: 'ACTIVE'
        };

        tx.set(bidRef, bid);
        tx.update(auctionRef, {
          currentPrice: newCurrentPrice,
          currentBidderId: newCurrentBidderId,
          proxyMaxBid: newProxyMaxBid,
          proxyBidderId: newProxyBidderId,
          secondHighestBidderId: newSecondHighestBidderId,
          secondHighestBidAmount: newSecondHighestBidAmount,
          endTime: newEndTime,
          bidCount: (auction.bidCount || 0) + 1,
          updatedAt: now,
        });

        // 5. Side Effects
        BidSideEffects.handleBidSideEffects(auction, bid, existingProxyBidder).catch(e => 
          log.error('BidProcessor: side effects failed', e, { auctionId, bidId })
        );

        incrementGlobalStat('totalBids').catch(() => {});

        return successResponse({
          bid,
          newEndTime,
          antiSnipeTriggered,
          newCurrentPrice,
        });
      });
    } catch (err) {
      log.error('BidProcessor.placeBid failed', err, { auctionId, userId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to place bid');
    }
  }
}
