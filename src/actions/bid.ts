'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { bidLimiter } from '@/lib/ratelimit';
import { ERROR_CODES } from '@/lib/constants';
import { BiddingService } from '@/services/bidding/bidding-service';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { log } from '@/lib/logger';

import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { getSystemConfig } from '@/actions/admin-content';
import { BidWithBidder, PlaceBidResult } from '@/types';
import { placeBidForUser, requireBiddingPrivileges } from '@/services/bidding/place-bid-core';

/**
 * Server Action: Place a bid on an auction.
 *
 * Thin wrapper: resolve the NextAuth session → userId + client IP/UA, then
 * delegate to placeBidForUser (shared with the native-app bridge at
 * /api/mobile/bid so both surfaces share one vetted code path).
 */
export async function placeBid(auctionId: string, amount: number): Promise<ServiceResponse<PlaceBidResult | null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const userAgent = h.get('user-agent') ?? 'unknown';

  return placeBidForUser(userId, auctionId, amount, ip, userAgent);
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

    // Feature kill-switch — Buy It Now can be disabled platform-wide.
    if (systemConfig?.buyItNowEnabled === false) {
      return errorResponse(ErrorType.VALIDATION, 'Buy It Now is currently disabled.');
    }

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
