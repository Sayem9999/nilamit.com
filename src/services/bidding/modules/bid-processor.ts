import { db, docData, incrementGlobalStat, newId } from '@/lib/db';
import { Auction, Bid, PlaceBidResult } from '@/types';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { ERROR_CODES } from '@/lib/constants';
import { log } from '@/lib/logger';
import { BidSideEffects } from './bid-side-effects';
import { validateBidPreconditions, computeAntiSnipeExtension } from '../bid-rules';
import { AuditService } from '@/services/admin/audit-service';

/** Discriminated result of the bid transaction closure. */
type BidTxOutcome =
  | { error: ServiceResponse<never> }
  | {
      result: PlaceBidResult;
      sideEffects: { auction: Auction; bid: Bid; prevBidderId: string | null; newEndTime: Date };
    };

/**
 * Map a thrown precondition error code (from validateBidPreconditions) to a
 * structured ServiceResponse. BID_TOO_LOW carries `newMinimum` so the client
 * can pre-fill the next valid bid.
 */
function mapPreconditionError(message: string, minRequired: number): ServiceResponse<never> {
  if (message.startsWith(ERROR_CODES.BID_TOO_LOW)) {
    return errorResponse(ErrorType.CONFLICT, `Bid must be at least ৳${minRequired.toLocaleString()}`, ERROR_CODES.BID_TOO_LOW, { newMinimum: minRequired });
  }
  if (message.startsWith(ERROR_CODES.AUCTION_NOT_ACTIVE)) return errorResponse(ErrorType.VALIDATION, 'Auction is not active');
  if (message.startsWith('AUCTION_NOT_STARTED'))          return errorResponse(ErrorType.VALIDATION, 'This auction has not started yet.');
  if (message.startsWith(ERROR_CODES.AUCTION_ENDED))      return errorResponse(ErrorType.VALIDATION, 'This auction has already ended.');
  if (message.startsWith(ERROR_CODES.SELF_BID_FORBIDDEN)) return errorResponse(ErrorType.VALIDATION, 'You cannot bid on your own auction');
  return errorResponse(ErrorType.VALIDATION, 'Invalid bid');
}

export class BidProcessor {
  /**
   * Atomic Transaction for placing a bid with Proxy Bidding support.
   *
   * Side-effects (RTDB writes, notifications, BigQuery rows, stat increments)
   * are deliberately fired AFTER the transaction commits — the Firestore SDK
   * retries the closure under contention, so anything inside it would multiply
   * on every retry (duplicate outbid pushes, double-counted bid totals, etc.).
   */
  static async placeBid(
    auctionId: string,
    amount: number,
    userId: string,
    ip?: string,
    userAgent?: string
  ): Promise<ServiceResponse<PlaceBidResult>> {
    try {
      const outcome = await db.runTransaction<BidTxOutcome>(async (tx) => {
        const auctionRef = db.collection('auctions').doc(auctionId);
        const auctionSnap = await tx.get(auctionRef);

        const auction = docData<Auction>(auctionSnap);
        if (!auction) return { error: errorResponse(ErrorType.NOT_FOUND, 'Auction not found') };

        const now = new Date();
        const endTime = auction.endTime instanceof Date ? auction.endTime : new Date(auction.endTime);
        const increment = auction.minBidIncrement ?? 10;
        const minRequired = (auction.currentPrice ?? auction.startingPrice) + increment;

        // 1. Preconditions — shared, unit-tested rules (status, start/end window,
        //    self-bid, min increment). Throws a coded Error on failure.
        try {
          validateBidPreconditions({
            auctionStatus: auction.status,
            endTime,
            startTime: auction.startTime,
            sellerId: auction.sellerId,
            bidderId: userId,
            currentPrice: auction.currentPrice,
            startingPrice: auction.startingPrice,
            minBidIncrement: auction.minBidIncrement,
            amount,
            now,
          });
        } catch (e) {
          return { error: mapPreconditionError(e instanceof Error ? e.message : '', minRequired) };
        }

        const existingProxy = auction.proxyMaxBid || auction.currentPrice || 0;
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
            return { error: errorResponse(ErrorType.VALIDATION, 'You already have a higher or equal max bid.') };
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

        // 3. Anti-Sniping — shared, unit-tested rule (extends from endTime).
        const { newEndTime, triggered: antiSnipeTriggered } = computeAntiSnipeExtension({ endTime, now });

        // 4. Build state
        const bid: Bid = {
          id: bidId,
          auctionId,
          bidderId: userId,
          amount,
          publicAmount: newCurrentPrice,
          createdAt: now,
          status: 'ACTIVE',
          ip,
          userAgent,
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
          wasExtended: antiSnipeTriggered || (auction.wasExtended ?? false),
          bidCount: (auction.bidCount || 0) + 1,
          updatedAt: now,
        };
        const afterState = beforeState ? { ...beforeState, ...updateData } : null;

        tx.set(bidRef, bid);
        tx.update(auctionRef, updateData);

        // Audit change is part of the transaction (uses tx) — safe to retry.
        await AuditService.logAuctionChange(auctionId, beforeState, afterState, 'UPDATE', userId, tx);

        return {
          result: { bid, newEndTime, antiSnipeTriggered, newCurrentPrice },
          sideEffects: { auction, bid, prevBidderId: existingProxyBidder, newEndTime },
        };
      });

      if ('error' in outcome) return outcome.error;

      // 5. Post-commit side-effects — fired exactly once (never inside the tx).
      const { auction, bid, prevBidderId, newEndTime } = outcome.sideEffects;
      BidSideEffects.handleBidSideEffects(auction, bid, prevBidderId, newEndTime).catch((e) =>
        log.error('BidProcessor: side effects failed', e, { auctionId, bidId: bid.id })
      );
      incrementGlobalStat('totalBids').catch(() => {});

      return successResponse(outcome.result);
    } catch (err) {
      log.error('BidProcessor.placeBid failed', err, { auctionId, userId, area: 'bid', severity: 'critical' });
      return errorResponse(ErrorType.INTERNAL, 'Failed to place bid');
    }
  }
}
