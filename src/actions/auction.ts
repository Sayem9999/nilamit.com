'use server';

import { auth } from '@/lib/auth';
import { db, snapDocs, toSellerPublic } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { AuctionService } from '@/services/auction/auction-service';
import { ERROR_CODES } from '@/lib/constants';
import type { Auction, AuctionFilters, AuctionWithSeller } from '@/types';
import { AuctionStatus } from '@/types';
import { createAuctionSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';

/**
 * Server Action: Fetch auctions with optional filtering
 */
export async function getAuctions(filters: AuctionFilters = {}) {
  const response = await AuctionService.list(filters);
  if (!response.success) {
    return { auctions: [], total: 0, pages: 0, currentPage: 1 };
  }
  return response.data!;
}

/**
 * Server Action: Fetch a single auction by ID
 */
export async function getAuction(id: string) {
  const response = await AuctionService.getById(id);
  if (!response.success) {
    return null;
  }
  return response.data!;
}

/**
 * Server Action: Create a new auction listing
 */
export async function createAuction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };

  const parsed = createAuctionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  try {
    const userSnap = await db.collection('users').doc(session.user.id).get();
    const userData = userSnap.data();

    if (!userData?.isPhoneVerified) return { success: false, error: ERROR_CODES.PHONE_NOT_VERIFIED };
    if (userData?.isBanned) return { success: false, error: 'Your account has been banned for policy violations.' };
    if (userData?.isMinor) return { success: false, error: 'Users under 18 are not eligible to list auctions.' };

    const response = await AuctionService.create(parsed.data, session.user.id);
    
    if (!response.success) {
      return { success: false, error: response.error?.message || 'Failed to create auction.' };
    }
    
    revalidatePath('/auctions');
    revalidatePath('/');
    
    return { success: true, auctionId: response.data!.id };
  } catch (error) {
    log.error('[Action] createAuction failed', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

/**
 * Homepage specialty feeds — shown alongside trending/featured.
 *   - endingSoon: active auctions closest to closing (next 48h).
 *   - latestBids: most recent bids across the marketplace, hydrated with
 *     bidder name + auction title for the live ticker.
 *
 * Both lists are small (<= 8 items). If they grow, move to materialised
 * views or a cached aggregate document.
 */
export async function getSpecializedFeeds() {
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
        .limit(10)
        .get(),
    ]);

    // Hydrate endingSoon with seller
    const endingDocs = snapDocs<Auction>(endingSoonSnap);
    const sellerIds = [...new Set(endingDocs.map((a) => a.sellerId))];
    const sellerSnaps = await Promise.all(sellerIds.map((id) => db.collection('users').doc(id).get()));
    const sellerMap = new Map(sellerSnaps.map((s) => [s.id, toSellerPublic(s.id, s.data())]));
    const endingSoon = endingDocs.map((a) => ({
      ...a,
      seller: sellerMap.get(a.sellerId)!,
      endTime: (a.endTime as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.endTime),
    })) as AuctionWithSeller[];

    // Hydrate latestBids with bidder + auction title
    const bidDocs = latestBidsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; amount: number; auctionId: string; bidderId: string; createdAt: FirebaseFirestore.Timestamp | Date }));
    const bidderIds = [...new Set(bidDocs.map((b) => b.bidderId))];
    const auctionIds = [...new Set(bidDocs.map((b) => b.auctionId))];
    const [bidderSnaps, auctionSnaps] = await Promise.all([
      Promise.all(bidderIds.map((id) => db.collection('users').doc(id).get())),
      Promise.all(auctionIds.map((id) => db.collection('auctions').doc(id).get())),
    ]);
    const biddersMap = new Map(bidderSnaps.map((s) => [s.id, { name: (s.data()?.name as string | null) ?? null }]));
    const auctionsMap = new Map(auctionSnaps.map((s) => [s.id, { id: s.id, title: (s.data()?.title as string | undefined) ?? 'Unknown' }]));

    const latestBids = bidDocs.map((b) => {
      const raw = b.createdAt as unknown as { toDate?: () => Date } | Date;
      const createdAt = raw instanceof Date ? raw : raw?.toDate?.() ?? new Date();
      return {
        id: b.id,
        amount: b.amount,
        createdAt,
        bidder: biddersMap.get(b.bidderId) ?? { name: null },
        auction: auctionsMap.get(b.auctionId) ?? { id: b.auctionId, title: 'Unknown' },
      };
    });

    return { endingSoon, latestBids };
  } catch (error) {
    log.error('[Action] getSpecializedFeeds failed', error);
    return { endingSoon: [] as AuctionWithSeller[], latestBids: [] as Array<{ id: string; amount: number; createdAt: Date; bidder: { name: string | null }; auction: { id: string; title: string } }> };
  }
}
