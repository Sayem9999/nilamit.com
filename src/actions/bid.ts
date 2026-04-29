'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { bidLimiter } from '@/lib/ratelimit';
import { ERROR_CODES } from '@/lib/constants';
import { BiddingService } from '@/services/bidding/bidding-service';
import { processAuctionSale } from '@/lib/auction-logic';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';

import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

async function requireBiddingPrivileges(userId: string): Promise<ServiceResponse<Record<string, unknown>>> {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'User not found', ERROR_CODES.NOT_FOUND);
  const user = userSnap.data()!;

  if (!user.isPhoneVerified) return errorResponse(ErrorType.UNAUTHORIZED, 'Phone verification required', ERROR_CODES.PHONE_NOT_VERIFIED);
  if (user.isBanned) return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');
  if (user.isMinor) return errorResponse(ErrorType.FORBIDDEN, 'Users under 18 are not eligible to place binding bids or purchases.', 'MINOR');

  return successResponse(user as Record<string, unknown>);
}

/**
 * Server Action: Place a bid on an auction
 */
export async function placeBid(auctionId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  // bidLimiter already fail-closes in production on Redis unavailability (see ratelimit.ts).
  const { success: rateLimitOk } = await bidLimiter.limit(`bid_${userId}_${ip}`);
  if (!rateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, 'Too many bids placed rapidly. Please wait a moment.');

  try {
    const privileges = await requireBiddingPrivileges(userId);
    if (!privileges.success) return privileges as ServiceResponse<never>;
    const user = privileges.data!;

    // Elite deposit check
    if (amount >= 100000 && !user.isVerifiedSeller) {
      const depositSnap = await db.collection('bidDeposits')
        .where('bidderId', '==', userId)
        .where('auctionId', '==', auctionId)
        .where('status', '==', 'held')
        .limit(1).get();
      if (depositSnap.empty) return errorResponse(ErrorType.FORBIDDEN, 'Elite deposit required', ERROR_CODES.ELITE_DEPOSIT_REQUIRED);
    }

    // Execute with high-level retry logic for contention handling
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      try {
        return successResponse(await BiddingService.placeBid(auctionId, amount, userId, session.user.name || 'Someone', session.user.email || ''));
      } catch (error) {
        attempts++;
        const message = error instanceof Error ? error.message : '';
        
        // Handle outbid / bid too low gracefully without retrying
        if (message.startsWith(ERROR_CODES.BID_TOO_LOW)) {
           return errorResponse(ErrorType.CONFLICT, message, ERROR_CODES.BID_TOO_LOW, { newMinimum: parseInt(message.replace(/\D/g, '')) });
        }
        
        // Only retry on transient contention/transaction errors
        const isContention = message.includes('too much contention') || message.includes('transaction failed');
        
        if (isContention && attempts < MAX_ATTEMPTS) {
          const delay = Math.pow(2, attempts) * 100 + Math.random() * 50;
          log.warn(`[Contention] Retrying bid ${attempts}/${MAX_ATTEMPTS}`, { auctionId, userId, delay });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        log.error('placeBid failed', error, { userId, auctionId, amount, attempts });
        return errorResponse(ErrorType.INTERNAL, message || 'Failed to place bid.');
      }
    }
    
    return errorResponse(ErrorType.INTERNAL, 'The bidding system is currently very busy. Please try again in a moment.');
  } catch (error) {
    log.error('placeBid outer failed', error, { userId, auctionId, amount });
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}

/**
 * Server Action: Buy It Now — instant purchase at the listed BIN price.
 *
 * Atomic: closes the auction (status → SOLD), records buyer as winner, and
 * upserts an escrow doc in PENDING via the shared `processAuctionSale`
 * helper. Failure modes mirror placeBid (auction inactive, ended, self-buy,
 * BIN unavailable). Buyer must be phone-verified; min/banned checks match
 * placeBid so users can't bypass them via BIN.
 */
export async function executeBuyItNow(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const { success: binRateLimitOk } = await bidLimiter.limit(`bin_${userId}_${ip}`);
  if (!binRateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, 'Too many purchase attempts. Please wait a moment.');

  try {
    const privileges = await requireBiddingPrivileges(userId);
    if (!privileges.success) return privileges as ServiceResponse<never>;
    const user = privileges.data!;

    await db.runTransaction(async (tx) => {
      const aRef = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);

      const now = new Date();
      const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
      if (now >= endTime) throw new Error(ERROR_CODES.AUCTION_ENDED);
      if (auction.sellerId === userId) throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);
      if (!auction.buyItNowPrice) throw new Error('BUY_IT_NOW_NOT_AVAILABLE');

      // Seller data needed by processAuctionSale for fee/escrow split
      const sellerSnap = await tx.get(db.collection('users').doc(auction.sellerId));
      const sellerData = sellerSnap.data() || {};

      await processAuctionSale(
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
          email: typeof user.email === 'string' ? user.email : null,
          name:  typeof user.name  === 'string' ? user.name  : 'Winner',
        },
        auction.buyItNowPrice,
      );
    });

    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    log.error('executeBuyItNow failed', error, { userId, auctionId });
    return errorResponse(ErrorType.INTERNAL, message);
  }
}

/**
 * Server Action: Fetch bid history for an auction
 */
export async function getAuctionBids(auctionId: string) {
  try {
    return await BiddingService.getAuctionBids(auctionId);
  } catch (error) {
    log.error('[Action] getAuctionBids failed', error);
    return [];
  }
}
