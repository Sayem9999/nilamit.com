'use server';

/**
 * Featured-listing self-serve purchase — seller entry points.
 *
 *   quoteFeaturedPurchase(days)        → price for a tier (UI display)
 *   initiateFeaturedPurchase(auctionId, days)
 *                                      → validates ownership + builds the
 *                                        `feat_` transaction id the gateway
 *                                        should use. The seller UI hands this
 *                                        to the payment init; on a verified
 *                                        callback, FeaturedService activates.
 *
 * The activation (money-in) lives in src/lib/featured-service.ts, driven by the
 * shared payment webhook — never trust the client to self-activate.
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import {
  FEATURED_TIERS,
  quoteFeatured,
  getFeaturedTier,
  buildFeaturedTranId,
} from '@/services/finance/featured';

export async function listFeaturedTiers(): Promise<ServiceResponse<typeof FEATURED_TIERS>> {
  return successResponse(FEATURED_TIERS);
}

export async function quoteFeaturedPurchase(
  days: number,
): Promise<ServiceResponse<{ days: number; priceBdt: number }>> {
  const quote = quoteFeatured(days);
  if (!quote) return errorResponse(ErrorType.VALIDATION, 'Unknown featured duration');
  return successResponse(quote);
}

export async function initiateFeaturedPurchase(
  auctionId: string,
  days: number,
): Promise<ServiceResponse<{ tranId: string; amountBdt: number; auctionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const tier = getFeaturedTier(days);
  if (!tier) return errorResponse(ErrorType.VALIDATION, 'Unknown featured duration');

  if (typeof auctionId !== 'string' || !auctionId) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auction');
  }

  try {
    const snap = await db.collection('auctions').doc(auctionId).get();
    if (!snap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    const a = snap.data()!;

    // Only the seller can promote their own listing, and only while it's live.
    if (a.sellerId !== session.user.id) {
      return errorResponse(ErrorType.FORBIDDEN, 'Only the seller can feature this listing');
    }
    if (a.status !== 'ACTIVE') {
      return errorResponse(ErrorType.VALIDATION, 'Only active listings can be featured');
    }

    const nonce = randomBytes(12).toString('hex');
    const tranId = buildFeaturedTranId(auctionId, tier.days, nonce);

    log.info('[featured] purchase initiated', { auctionId, days: tier.days, userId: session.user.id });
    return successResponse({ tranId, amountBdt: tier.priceBdt, auctionId });
  } catch (err) {
    log.error('[featured] initiate failed', err, { auctionId, area: 'admin' });
    return errorResponse(ErrorType.INTERNAL, 'Could not start featured purchase');
  }
}
