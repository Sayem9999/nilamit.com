'use server';

import { auth } from '@/lib/auth';
import { db, snapDocs, toSellerPublic } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { AuctionService } from '@/services/auction/auction-service';
import { ERROR_CODES } from '@/lib/constants';
import type { Auction, AuctionFilters, AuctionWithSeller, AuctionListResponse, LatestActivity } from '@/types';
import { AuctionStatus } from '@/types';
import { createAuctionSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { cache } from 'react';

/**
 * Server Action: Fetch auctions with optional filtering
 */
export const getAuctions = cache(async (filters: AuctionFilters = {}): Promise<ServiceResponse<AuctionListResponse>> => {
  const session = await auth();
  const response = await AuctionService.list({ 
    ...filters, 
    viewerId: session?.user?.id 
  });
  
  if (!response.success) {
    log.error('[Action] getAuctions failed', undefined, { error: response.error?.message });
    return errorResponse(ErrorType.INTERNAL, response.error?.message || 'Failed to fetch auctions');
  }
  return successResponse(response.data!);
});

/**
 * Server Action: Fetch a single auction by ID (Memoized)
 */
export const getAuction = cache(async (id: string): Promise<ServiceResponse<AuctionWithSeller | null>> => {
  const session = await auth();
  const response = await AuctionService.getById(id, session?.user?.id);
  if (!response.success) {
    return errorResponse(ErrorType.NOT_FOUND, response.error?.message || 'Auction not found');
  }
  return successResponse(response.data!);
});

/**
 * Server Action: Create a new auction listing
 */
export async function createAuction(input: unknown): Promise<ServiceResponse<{ auctionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  const parsed = createAuctionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  try {
    const userSnap = await db.collection('users').doc(session.user.id).get();
    const userData = userSnap.data();

    if (!userData?.isPhoneVerified) return errorResponse(ErrorType.UNAUTHORIZED, 'Phone not verified', ERROR_CODES.PHONE_NOT_VERIFIED);
    if (userData?.isBanned) return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');
    if (userData?.isMinor) return errorResponse(ErrorType.FORBIDDEN, 'Users under 18 are not eligible to list auctions.', 'MINOR');

    const response = await AuctionService.create(parsed.data, session.user.id);
    
    if (!response.success) {
      return errorResponse(ErrorType.INTERNAL, response.error?.message || 'Failed to create auction.');
    }
    
    revalidatePath('/auctions');
    revalidatePath('/');
    
    return successResponse({ auctionId: response.data!.id });
  } catch (error) {
    log.error('[Action] createAuction failed', error);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}

/**
 * Homepage specialty feeds — shown alongside trending/featured.
 */
export const getSpecializedFeeds = cache(async (): Promise<ServiceResponse<{ 
  endingSoon: AuctionWithSeller[], 
  latestBids: LatestActivity[] 
}>> => {
  return AuctionService.getSpecializedFeeds();
});
/**
 * Server Action: Manually trigger a Second Chance Offer
 * Only the seller of the auction can trigger this if the winner fails to pay.
 */
export async function triggerSecondChanceOffer(auctionId: string): Promise<ServiceResponse<void>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  try {
    const auctionRes = await AuctionService.getById(auctionId, session.user.id);
    if (!auctionRes.success) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    
    const auction = auctionRes.data!;
    if (auction.sellerId !== session.user.id) {
      return errorResponse(ErrorType.FORBIDDEN, 'Only the seller can offer a second chance.');
    }

    // Only allowed if SOLD but escrow failed or expired (simulated here)
    if (auction.status !== AuctionStatus.SOLD) {
      return errorResponse(ErrorType.CONFLICT, 'Only sold auctions can be offered second chance.');
    }

    const result = await AuctionService.createSecondChanceOffer(auctionId);
    
    if (result.success) {
      revalidatePath(`/auctions/${auctionId}`);
      revalidatePath('/dashboard');
    }
    
    return result;
  } catch (error) {
    log.error('[Action] triggerSecondChanceOffer failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to create second chance offer');
  }
}
