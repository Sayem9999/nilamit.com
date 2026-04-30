'use server';

import { auth } from '@/lib/auth';
import { db, snapDocs, toSellerPublic } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { AuctionService } from '@/services/auction/auction-service';
import { ERROR_CODES } from '@/lib/constants';
import type { Auction, AuctionFilters, AuctionWithSeller, AuctionListResponse, BidWithAuction } from '@/types';
import { AuctionStatus } from '@/types';
import { createAuctionSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

/**
 * Server Action: Fetch auctions with optional filtering
 */
export async function getAuctions(filters: AuctionFilters = {}): Promise<ServiceResponse<AuctionListResponse>> {
  const response = await AuctionService.list(filters);
  if (!response.success) {
    log.error('[Action] getAuctions failed', undefined, { error: response.error?.message });
    return errorResponse(ErrorType.INTERNAL, response.error?.message || 'Failed to fetch auctions');
  }
  return successResponse(response.data!);
}

/**
 * Server Action: Fetch a single auction by ID
 */
export async function getAuction(id: string): Promise<ServiceResponse<Auction | null>> {
  const response = await AuctionService.getById(id);
  if (!response.success) {
    return errorResponse(ErrorType.NOT_FOUND, response.error?.message || 'Auction not found');
  }
  return successResponse(response.data!);
}

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
export async function getSpecializedFeeds(): Promise<ServiceResponse<{ 
  endingSoon: AuctionWithSeller[], 
  latestBids: BidWithAuction[] 
}>> {
  try {
    const nowTs = new Date();
    const in48h = new Date(nowTs.getTime() + 48 * 60 * 60 * 1000);

    const [endingSoonSnap, latestBidsSnap] = await Promise.all([
      db.collection('auctions')
        .where('status', '==', AuctionStatus.ACTIVE)
        .where('endTime', '>', nowTs)
        .where('endTime', '<=', in48h)
        .orderBy('endTime', 'asc')
        .limit(8)
        .get(),
      db.collection('bids')
        .orderBy('createdAt', 'desc')
        .limit(25)
        .get(),
    ]);

    const endingDocs = snapDocs<Auction>(endingSoonSnap);
    const sellerIds = [...new Set(endingDocs.map((a) => a.sellerId))];
    let sellerMap = new Map<string, ReturnType<typeof toSellerPublic>>();
    if (sellerIds.length > 0) {
      const sellerRefs = sellerIds.map((id) => db.collection('users').doc(id));
      const sellerSnaps = await db.getAll(...sellerRefs);
      sellerMap = new Map(sellerSnaps.map((s) => [s.id, toSellerPublic(s.id, s.data())]));
    }
    const endingSoon = endingDocs.map((a) => ({
      ...a,
      seller: sellerMap.get(a.sellerId)!,
      endTime: (a.endTime as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.endTime),
    })) as AuctionWithSeller[];

    const bidDocs = latestBidsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; amount: number; auctionId: string; bidderId: string; createdAt: FirebaseFirestore.Timestamp | Date }));
    const bidderIds = [...new Set(bidDocs.map((b) => b.bidderId))];
    const auctionIds = [...new Set(bidDocs.map((b) => b.auctionId))];
    
    let biddersMap = new Map<string, { name: string | null }>();
    let auctionsMap = new Map<string, { id: string; title: string; status: string }>();

    if (bidderIds.length > 0 && auctionIds.length > 0) {
      const bidderRefs = bidderIds.map((id) => db.collection('users').doc(id));
      const auctionRefs = auctionIds.map((id) => db.collection('auctions').doc(id));
      
      const [bidderSnaps, auctionSnaps] = await Promise.all([
        db.getAll(...bidderRefs),
        db.getAll(...auctionRefs),
      ]);
      
      biddersMap = new Map(bidderSnaps.map((s) => [s.id, { name: (s.data()?.name as string | null) ?? null }]));
      auctionsMap = new Map(auctionSnaps.map((s) => [s.id, { id: s.id, title: (s.data()?.title as string | undefined) ?? 'Unknown', status: (s.data()?.status as string | undefined) ?? '' }]));
    }

    const latestBids = bidDocs
      .filter((b) => auctionsMap.get(b.auctionId)?.status === AuctionStatus.ACTIVE)
      .slice(0, 10)
      .map((b) => {
        const raw = b.createdAt as unknown as { toDate?: () => Date } | Date;
        const createdAt = raw instanceof Date ? raw : raw?.toDate?.() ?? new Date();
        const auctionEntry = auctionsMap.get(b.auctionId) ?? { id: b.auctionId, title: 'Unknown' };
        return {
          id: b.id,
          amount: b.amount,
          createdAt,
          bidder: biddersMap.get(b.bidderId) ?? { name: null },
          auction: { id: auctionEntry.id, title: auctionEntry.title },
        };
      });

    return successResponse({ endingSoon, latestBids });
  } catch (error) {
    log.error('[Action] getSpecializedFeeds failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch feeds');
  }
}
