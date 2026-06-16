/**
 * create-core.ts — shared create-auction logic used by the native bridge
 * (/api/mobile/auctions). Mirrors the gates in the web Server Action
 * (src/actions/auction.ts::createAuction): feature kill-switch, posting
 * requirements (email verified), ban/minor checks, then AuctionService.create.
 * Server-only lib (not 'use server').
 */
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { createAuctionSchema, formatZodError } from '@/lib/schemas';
import { ERROR_CODES } from '@/lib/constants';
import { getSystemConfig } from '@/actions/admin-content';
import { AuctionService } from '@/services/auction/auction-service';

export async function createAuctionForUser(
  userId: string,
  input: unknown,
): Promise<ServiceResponse<{ auctionId: string }>> {
  const parsed = createAuctionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  try {
    const configRes = await getSystemConfig();
    const systemConfig = configRes.success ? configRes.data : null;

    if (systemConfig?.newListingsEnabled === false) {
      return errorResponse(ErrorType.FORBIDDEN, 'New listings are temporarily paused. Please check back soon.');
    }

    const postingReqs = systemConfig?.postingRequirementsEnabled ?? true;
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();

    if (postingReqs) {
      const isEmailVerified = userData?.emailVerified != null;
      if (!isEmailVerified)
        return errorResponse(ErrorType.UNAUTHORIZED, 'Verification required. Please verify your email.', ERROR_CODES.UNAUTHORIZED);
    }
    if (userData?.isBanned) return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');
    if (userData?.isMinor) return errorResponse(ErrorType.FORBIDDEN, 'Users under 18 are not eligible to list auctions.', 'MINOR');

    const response = await AuctionService.create(parsed.data, userId);
    if (!response.success) {
      return errorResponse(ErrorType.INTERNAL, response.error?.message || 'Failed to create auction.');
    }

    if (!userData?.isVerifiedSeller) {
      await db.collection('users').doc(userId).update({ isVerifiedSeller: true, updatedAt: new Date() });
    }

    log.event('auction_created', {
      userId,
      auctionId: response.data!.id,
      metadata: { category: parsed.data.category, firstListing: !userData?.isVerifiedSeller, source: 'mobile' },
    });

    revalidatePath('/auctions');
    revalidatePath('/');
    revalidatePath('/dashboard');

    return successResponse({ auctionId: response.data!.id });
  } catch (error) {
    log.error('[auction] createAuctionForUser failed', error, { userId, area: 'admin', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}
