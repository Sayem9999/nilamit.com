import { db, docData, incrementGlobalStat, newId } from '@/lib/db';
import { Auction, Bid, AuctionStatus, PlaceBidResult } from '@/types';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { BidSideEffects } from './bid-side-effects';
import { AuditService } from '@/services/admin/audit-service';

export class BidProcessor {
  /**
   * Atomic Transaction for placing a bid with Proxy Bidding support
   */
  static async placeBid(auctionId: string, amount: number, userId: string): Promise<ServiceResponse<PlaceBidResult>> {
    try {
      return await db.runTransaction(async (tx) => {
        const auctionRef = db.collection('auctions').doc(auctionId);
        const auctionSnap = await tx.get(auctionRef);
        
        const auction = docData<Auction>(auctionSnap);
        if (!auction) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');

        // 1. Validation
        if (auction.status !== AuctionStatus.ACTIVE) return errorResponse(ErrorType.VALIDATION, 'Auction is not active');
        if (userId === auction.sellerId) return errorResponse(ErrorType.VALIDATION, 'You cannot bid on your own auction');
        
        const increment = auction.minBidIncrement ?? 10;
        if (amount < auction.currentPrice + increment) {
          return errorResponse(ErrorType.VALIDATION, `Bid must be at least ${auction.currentPrice + increment}`);
        }

        const now = new Date();
        const existingProxy = auction.proxyMaxBid || auction.currentPrice || 0;
        const existingProxyBidder = auction.proxyBidderId ?? null;

        let newCurrentPrice = auction.currentPrice;
        let newCurrentBidderId = auction.currentBidderId;
        let newProxyMaxBid = auction.proxyMaxBid ?? 0;
        let newProxyBidderId = auction.proxyBidderId ?? null;
        
        let newSecondHighestBidderId = auction.secondHighestBidderId ?? null;
        let newSecondHighestBidAmount = auction.secondHighestBidAmount ?? 0;

        // 2. Direct Bidding Logic (User requested highest bid = current price)
        if (!newCurrentBidderId) {
          newCurrentPrice = amount;
          newCurrentBidderId = userId;
          newProxyMaxBid = amount;
          newProxyBidderId = userId;
        } else if (userId === existingProxyBidder) {
          return errorResponse(ErrorType.VALIDATION, 'You are already the highest bidder.');
        } else {
          if (amount > existingProxy) {
            newSecondHighestBidderId = existingProxyBidder;
            newSecondHighestBidAmount = existingProxy;
            newCurrentPrice = amount;
            newCurrentBidderId = userId;
            newProxyMaxBid = amount;
            newProxyBidderId = userId;
          } else {
            return errorResponse(ErrorType.VALIDATION, `Bid must be higher than current bid of ${existingProxy}`);
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

        const beforeState = auctionSnap.data() || null;
        const updateData = {
          currentPrice: newCurrentPrice,
          currentBidderId: newCurrentBidderId,
          proxyMaxBid: newProxyMaxBid,
          proxyBidderId: newProxyBidderId,
          secondHighestBidderId: newSecondHighestBidderId,
          secondHighestBidAmount: newSecondHighestBidAmount,
          endTime: newEndTime,
          bidCount: (auction.bidCount || 0) + 1,
          updatedAt: now,
        };
        const afterState = beforeState ? { ...beforeState, ...updateData } : null;

        tx.set(bidRef, bid);
        tx.update(auctionRef, updateData);

        // Log audit change atomically within the transaction
        AuditService.logAuctionChange(auctionId, beforeState, afterState, 'UPDATE', userId, tx).catch(() => {});

        // 5. Side Effects
        BidSideEffects.handleBidSideEffects(auction, bid, existingProxyBidder, newEndTime).catch(e => 
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
