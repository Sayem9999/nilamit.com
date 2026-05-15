'use server';

import { auth } from '@/lib/auth';
import { db, snapDocs, toSellerPublic } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { AuctionService } from '@/services/auction/auction-service';
import { ERROR_CODES } from '@/lib/constants';
import type { Auction, AuctionFilters, AuctionWithSeller, AuctionListResponse, LatestActivity } from '@/types';
import { AuctionStatus } from '@/types';
import { createAuctionSchema, editAuctionSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { cache } from 'react';

import { unstable_cache } from 'next/cache';

/**
 * Server Action: Fetch auctions with optional filtering
 */
export const getAuctions = cache(async (filters: AuctionFilters = {}): Promise<ServiceResponse<AuctionListResponse>> => {
  const session = await auth();
  
  // Use unstable_cache to avoid heavy Firestore queries on every page load
  const fetchAuctions = unstable_cache(
    async (f: AuctionFilters, uid?: string) => {
      const response = await AuctionService.list({ 
        ...f, 
        viewerId: uid 
      });
      return response.success ? response.data : null;
    },
    [`auctions-list-${JSON.stringify(filters)}-${session?.user?.id}`],
    { revalidate: 60, tags: ['auctions'] }
  );

  const data = await fetchAuctions(filters, session?.user?.id);
  
  if (!data) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch auctions');
  }
  return successResponse(data);
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

    const isEmailVerified = userData?.emailVerified != null;
    if (!isEmailVerified) return errorResponse(ErrorType.UNAUTHORIZED, 'Verification required. Please verify your email.', ERROR_CODES.UNAUTHORIZED);
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
    log.error('[auction] createAuction failed', error);
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
  const fetchFeeds = unstable_cache(
    async () => {
      return AuctionService.getSpecializedFeeds();
    },
    ['specialized-feeds'],
    { revalidate: 60, tags: ['auctions', 'bids'] }
  );

  return fetchFeeds();
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
    log.error('[auction] triggerSecondChanceOffer failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to create second chance offer');
  }
}

// ─── Seller management ────────────────────────────────────────────────────

const RELISTABLE_STATES: ReadonlySet<string> = new Set([
  AuctionStatus.EXPIRED,
  AuctionStatus.CANCELLED,
]);

/**
 * Server Action: Cancel an active auction with no bids.
 * Locked once a single bid lands — bidders shouldn't have rugs pulled.
 */
export async function cancelAuction(auctionId: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  if (!auctionId || typeof auctionId !== 'string') {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auction id');
  }

  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection('auctions').doc(auctionId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const a = snap.data()!;

      if (a.sellerId !== userId)        throw new Error('UNAUTHORIZED');
      if (a.status !== AuctionStatus.ACTIVE) throw new Error('NOT_ACTIVE');
      if ((a.bidCount ?? 0) > 0)        throw new Error('HAS_BIDS');

      tx.update(ref, {
        status:    AuctionStatus.CANCELLED,
        updatedAt: new Date(),
      });
    });

    revalidatePath('/auctions');
    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    if (code === 'NOT_FOUND')    return errorResponse(ErrorType.NOT_FOUND,    'Auction not found');
    if (code === 'UNAUTHORIZED') return errorResponse(ErrorType.FORBIDDEN,    'Only the seller can cancel this auction.');
    if (code === 'NOT_ACTIVE')   return errorResponse(ErrorType.CONFLICT,     'Only active auctions can be cancelled.');
    if (code === 'HAS_BIDS')     return errorResponse(ErrorType.CONFLICT,     'Cannot cancel after bids have been placed.');

    log.error('[Action] cancelAuction failed', error, { auctionId, userId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to cancel auction.');
  }
}

/**
 * Server Action: Edit description and/or images on an auction with no bids.
 * Title, pricing, and timing are deliberately not editable post-publish.
 */
export async function editAuction(input: unknown): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  const parsed = editAuctionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const { auctionId, description, images } = parsed.data;

  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection('auctions').doc(auctionId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const a = snap.data()!;

      if (a.sellerId !== userId)             throw new Error('UNAUTHORIZED');
      if (a.status !== AuctionStatus.ACTIVE) throw new Error('NOT_ACTIVE');
      if ((a.bidCount ?? 0) > 0)             throw new Error('HAS_BIDS');

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (description !== undefined) patch.description = description;
      if (images !== undefined)      patch.images      = images;

      tx.update(ref, patch);
    });

    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    if (code === 'NOT_FOUND')    return errorResponse(ErrorType.NOT_FOUND,  'Auction not found');
    if (code === 'UNAUTHORIZED') return errorResponse(ErrorType.FORBIDDEN,  'Only the seller can edit this auction.');
    if (code === 'NOT_ACTIVE')   return errorResponse(ErrorType.CONFLICT,   'Only active auctions can be edited.');
    if (code === 'HAS_BIDS')     return errorResponse(ErrorType.CONFLICT,   'Cannot edit after bids have been placed.');

    log.error('[Action] editAuction failed', error, { auctionId, userId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to edit auction.');
  }
}

/**
 * Server Action: Relist an EXPIRED or CANCELLED auction as a new ACTIVE one.
 * Title, description, images, category, and pricing copy across; start time
 * defaults to now + 1 hour and the original duration is preserved.
 */
export async function relistAuction(auctionId: string): Promise<ServiceResponse<{ auctionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  const userId = session.user.id;

  if (!auctionId || typeof auctionId !== 'string') {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auction id');
  }

  try {
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();
    const isEmailVerified = userData?.emailVerified != null;
    if (!isEmailVerified) return errorResponse(ErrorType.UNAUTHORIZED, 'Verification required. Please verify your email.', ERROR_CODES.UNAUTHORIZED);
    if (userData?.isBanned)         return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');

    const origSnap = await db.collection('auctions').doc(auctionId).get();
    if (!origSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    const orig = origSnap.data()!;

    if (orig.sellerId !== userId) {
      return errorResponse(ErrorType.FORBIDDEN, 'Only the seller can relist this auction.');
    }
    if (!RELISTABLE_STATES.has(orig.status)) {
      return errorResponse(ErrorType.CONFLICT, `Only EXPIRED or CANCELLED auctions can be relisted (current: ${orig.status}).`);
    }

    const origStart = orig.startTime?.toDate ? orig.startTime.toDate() : new Date(orig.startTime);
    const origEnd   = orig.endTime?.toDate   ? orig.endTime.toDate()   : new Date(orig.endTime);
    const durationMs = Math.max(60 * 60 * 1000, origEnd.getTime() - origStart.getTime());

    const newStart = new Date(Date.now() + 60 * 60 * 1000);
    const newEnd   = new Date(newStart.getTime() + durationMs);

    // Reuse the create pipeline so PII filters, validation, and stat increments
    // all fire identically to a fresh listing.
    const response = await AuctionService.create({
      title:           orig.title,
      description:     orig.description,
      images:          orig.images ?? [],
      category:        orig.category,
      startingPrice:   orig.startingPrice,
      minBidIncrement: orig.minBidIncrement,
      startTime:       newStart,
      endTime:         newEnd,
      reservePrice:    orig.reservePrice ?? undefined,
      buyItNowPrice:   orig.buyItNowPrice ?? undefined,
      location:        orig.location ?? undefined,
      condition:       orig.condition ?? undefined,
    }, userId);

    if (!response.success || !response.data) {
      return errorResponse(ErrorType.INTERNAL, response.error?.message || 'Failed to relist.');
    }

    revalidatePath('/auctions');
    revalidatePath('/dashboard');
    return successResponse({ auctionId: response.data.id });
  } catch (error) {
    log.error('[Action] relistAuction failed', error, { auctionId, userId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to relist auction.');
  }
}
