'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { bidLimiter } from '@/lib/ratelimit';
import { ERROR_CODES } from '@/lib/constants';
import { BiddingService } from '@/services/bidding/bidding-service';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { log } from '@/lib/logger';

import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { placeBidSchema, formatZodError } from '@/lib/schemas';
import { getSystemConfig } from '@/actions/admin-content';
import { BidWithBidder, PlaceBidResult, SystemConfig } from '@/types';

async function requireBiddingPrivileges(userId: string, systemConfig?: SystemConfig | null): Promise<ServiceResponse<Record<string, unknown>>> {
  const fetchPrivileges = unstable_cache(
    async (uid: string) => {
      const userSnap = await db.collection('users').doc(uid).get();
      if (!userSnap.exists) return { error: ERROR_CODES.NOT_FOUND };
      return { data: userSnap.data() };
    },
    [`user-privileges-${userId}`],
    { revalidate: 30, tags: [`user-${userId}`] }
  );

  const result = await fetchPrivileges(userId);
  if (result.error) return errorResponse(ErrorType.NOT_FOUND, 'User not found', result.error);
  
  const user = result.data!;
  const biddingReqs = systemConfig?.biddingRequirementsEnabled ?? true;
  if (biddingReqs) {
    const isEmailVerified = user.emailVerified != null;
    if (!isEmailVerified) return errorResponse(ErrorType.UNAUTHORIZED, 'Verification required. Please verify your email.', ERROR_CODES.UNAUTHORIZED);
  }
  if (user.isBanned) return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');
  if (user.isMinor) return errorResponse(ErrorType.FORBIDDEN, 'Users under 18 are not eligible to place binding bids or purchases.', 'MINOR');

  return successResponse(user as Record<string, unknown>);
}

/**
 * Server Action: Place a bid on an auction
 */
export async function placeBid(auctionId: string, amount: number): Promise<ServiceResponse<PlaceBidResult | null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  const parsed = placeBidSchema.safeParse({ auctionId, amount });
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  // bidLimiter is fail-closed in production (see ratelimit.ts).
  const { success: rateLimitOk } = await bidLimiter.limit(`bid_${userId}_${ip}`);
  if (!rateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, 'Too many bids placed rapidly. Please wait a moment.');

  try {
    const configRes = await getSystemConfig();
    const systemConfig = configRes.success ? configRes.data : null;

    const privileges = await requireBiddingPrivileges(userId, systemConfig);
    if (!privileges.success) return privileges as ServiceResponse<never>;
    const user = privileges.data!;

    // ─── TIER 2: MFS Linkage Check (৳50,000+) ────────────────────────────────
    // Deter "fun bidders" by requiring a traceable payment account linked.
    const mfsReq = systemConfig?.mfsLinkageRequired ?? true;
    if (mfsReq && amount >= 50000 && !user.bkashNumber && !user.nagadNumber) {
      return errorResponse(
        ErrorType.FORBIDDEN,
        'MFS account linkage required for high-stake bidding (৳50,000+). Please link bKash or Nagad in your profile.',
        ERROR_CODES.MFS_LINKAGE_REQUIRED
      );
    }

    // ─── TIER 3: Elite Trust Gate (৳150,000+) ────────────────────────────────
    // For very high-value items, we require the user to be a "Vetted Seller"
    // OR have high performance metrics (Rating + Volume).
    const ELITE_THRESHOLD = 150000;
    const MIN_RATING = 4.5;
    const MIN_SALES = 5;

    if (amount >= ELITE_THRESHOLD) {
      const isVetted = user.isVerifiedSeller;
      const currentRating = (user.rating as number) ?? 0;
      const salesCount = (user.ratingCount as number) ?? 0;

      // Trust Waiver Check
      if (!isVetted && (currentRating < MIN_RATING || salesCount < MIN_SALES)) {
        // Fallback: Check for a 1% Security Deposit
        const requiredDeposit = Math.floor(amount * 0.01);
        const depositSnap = await db.collection('bidDeposits')
          .where('bidderId', '==', userId)
          .where('auctionId', '==', auctionId)
          .where('status', '==', 'held')
          .get();

        const totalHeld = depositSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);

        if (totalHeld < requiredDeposit) {
          return errorResponse(
            ErrorType.FORBIDDEN, 
            `` + `Elite auctions (৳150k+) require a 4.5★ rating or a 1% security deposit (৳${requiredDeposit.toLocaleString()}).`, 
            ERROR_CODES.ELITE_DEPOSIT_REQUIRED
          );
        }
      }
    }

    // Execute with high-level retry logic for contention handling
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      try {
        const result = await BiddingService.placeBid(auctionId, amount, userId, session.user.name || 'Someone', session.user.email || '');
        
        revalidateTag('auctions', { expire: 0 });
        revalidateTag('bids',     { expire: 0 });
        revalidateTag('stats',    { expire: 0 });
        revalidatePath(`/auctions/${auctionId}`);
        revalidatePath('/auctions');
        revalidatePath('/dashboard');
        revalidatePath('/');
        
        if (!result.success) return result as ServiceResponse<never>;
        return successResponse(result.data!);
      } catch (error) {
        attempts++;
        const message = error instanceof Error ? error.message : '';
        
        // Handle outbid / bid too low gracefully without retrying.
        // Format: `BID_TOO_LOW: ৳<amount>` — extract digits only from the trailing
        // amount portion to avoid concatenating digits embedded in the prefix.
        if (message.startsWith(ERROR_CODES.BID_TOO_LOW)) {
          const amountPart = message.slice(ERROR_CODES.BID_TOO_LOW.length);
          const newMinimum = parseInt(amountPart.replace(/\D/g, ''), 10) || undefined;
          return errorResponse(ErrorType.CONFLICT, message, ERROR_CODES.BID_TOO_LOW, { newMinimum });
        }
        
        // Only retry on transient contention/transaction errors
        const isContention = message.includes('too much contention') || message.includes('transaction failed');
        
        if (isContention && attempts < MAX_ATTEMPTS) {
          const delay = Math.pow(2, attempts) * 100 + Math.random() * 50;
          log.warn(`[Contention] Retrying bid ${attempts}/${MAX_ATTEMPTS}`, { auctionId, userId, delay });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        log.error('[bid] placeBid failed', error, { userId, auctionId, amount, attempts, area: 'bid', severity: 'critical' });
        return errorResponse(ErrorType.INTERNAL, message || 'Failed to place bid.');
      }
    }
    
    return errorResponse(ErrorType.INTERNAL, 'The bidding system is currently very busy. Please try again in a moment.');
  } catch (error) {
    log.error('[bid] placeBid outer failed', error, { userId, auctionId, amount, area: 'bid', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}

/**
 * Server Action: Buy It Now — instant purchase at the listed BIN price.
 */
export async function executeBuyItNow(auctionId: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const { success: binRateLimitOk } = await bidLimiter.limit(`bin_${userId}_${ip}`);
  if (!binRateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, 'Too many purchase attempts. Please wait a moment.');

  try {
    const configRes = await getSystemConfig();
    const systemConfig = configRes.success ? configRes.data : null;

    const privileges = await requireBiddingPrivileges(userId, systemConfig);
    if (!privileges.success) return privileges as ServiceResponse<never>;
    const user = privileges.data!;

    await BiddingService.executeBuyItNow(
      auctionId,
      userId,
      typeof user.name === 'string' ? user.name : 'Winner',
      typeof user.email === 'string' ? user.email : null
    );

    revalidateTag('auctions', { expire: 0 });
    revalidateTag('bids',     { expire: 0 });
    revalidateTag('stats',    { expire: 0 });
    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/auctions');
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    log.error('[bid] executeBuyItNow failed', error, { userId, auctionId, area: 'bid', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, message);
  }
}

/**
 * Server Action: Fetch bid history for an auction
 */
export async function getAuctionBids(auctionId: string): Promise<ServiceResponse<BidWithBidder[]>> {
  try {
    const fetchBids = unstable_cache(
      async (aid: string) => {
        return BiddingService.getAuctionBids(aid);
      },
      [`auction-bids-${auctionId}`],
      { revalidate: 10, tags: ['bids', `auction-bids-${auctionId}`] }
    );
    const bids = await fetchBids(auctionId);
    return successResponse(bids);
  } catch (error) {
    log.error('[bid] getAuctionBids failed', error, { area: 'bid', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch bids');
  }
}
