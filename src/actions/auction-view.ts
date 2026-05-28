'use server';

/**
 * Auction view-count incrementer.
 *
 * Fired from the client `AuctionViewTracker` ~1s after the auction detail
 * page mounts. Rate-limited per (auctionId, viewerKey) for 30 minutes
 * via Upstash so refresh + dev-tools won't inflate the counter.
 *
 * Reads as analytics by sellers (Auction.viewCount denormalized field).
 * We don't increment the auction's seller's own views — sellers reload
 * their own listings frequently and the metric should reflect external interest.
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiLimiter } from '@/lib/ratelimit';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { FieldValue } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

export async function recordAuctionView(auctionId: string): Promise<ServiceResponse<null>> {
  if (!auctionId || auctionId.length > 128 || auctionId.includes('/')) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auctionId');
  }

  // Anonymous viewers count too — key on viewerId if signed in, else IP.
  const session = await auth();
  const viewerId = session?.user?.id;
  const headerStore = await headers();
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0].trim() ??
    headerStore.get('x-real-ip') ??
    'anon';
  const viewerKey = viewerId ?? `ip:${ip}`;

  // 1 view per (auction, viewer) per 30min window. Fail-open is fine —
  // the worst case is slightly inflated counts during a rate-limit outage.
  const rl = await apiLimiter.limit(`view:${auctionId}:${viewerKey}`);
  if (!rl.success) return successResponse(null);

  try {
    const auctionRef = db.collection('auctions').doc(auctionId);
    // Self-view exclusion: read the seller field first; skip if viewer == seller.
    const snap = await auctionRef.get();
    if (!snap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    const data = snap.data() as { sellerId?: string };
    if (viewerId && viewerId === data.sellerId) return successResponse(null);

    await auctionRef.update({
      viewCount: FieldValue.increment(1),
      lastViewedAt: FieldValue.serverTimestamp(),
    });
    return successResponse(null);
  } catch (err) {
    log.warn('[auction-view] increment failed', { auctionId, error: String(err) });
    return errorResponse(ErrorType.INTERNAL, 'view increment failed');
  }
}
