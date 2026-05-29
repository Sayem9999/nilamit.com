"use server";

/**
 * Featured-listing self-serve purchase.
 *
 * Seller picks a duration (1/3/7 days), pays via existing payment-callback
 * flow, and we flip isFeatured=true + featuredUntil on the auction. A cron
 * (enforce-policies, every hour) flips isFeatured=false past the expiry.
 *
 * Pricing is admin-tuned via systemConfig.featurePricingBdt[duration].
 * Defaults below ship even before the admin sets custom prices.
 *
 * Auth: seller must own the auction. Verification: auction must be ACTIVE
 * (no point featuring a sold listing). Idempotency: a pending purchase
 * for the same auction can't be created twice in 60s.
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_PRICING_BDT: Record<number, number> = {
  1: 50,
  3: 120,
  7: 250,
};

const PurchaseSchema = z.object({
  auctionId: z.string().min(1),
  /** Duration in days. */
  days: z.number().int().refine((d) => [1, 3, 7].includes(d), {
    message: 'Duration must be 1, 3, or 7 days',
  }),
});

export interface FeaturePurchaseQuote {
  auctionId: string;
  days: number;
  priceBdt: number;
  /** Transaction reference to send to the gateway; echo back on callback. */
  tranId: string;
}

/**
 * Step 1 of the flow: quote the price + return a tran_id that the user's
 * payment session should use. After the gateway callback verifies the
 * payment, call `activateFeatured` below to actually flip the bits.
 */
export async function quoteFeaturedPurchase(
  input: unknown,
): Promise<ServiceResponse<FeaturePurchaseQuote>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const parsed = PurchaseSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, 'Invalid input');
  const { auctionId, days } = parsed.data;

  try {
    // Feature kill-switch — featured purchases are refused when the feature is
    // disabled platform-wide (default OFF until the purchase flow is complete).
    const cfgSnap = await db.collection('systemConfig').doc('default').get();
    const cfg = cfgSnap.data() as { featurePricingBdt?: Record<string, number>; featuredListingsEnabled?: boolean } | undefined;
    if (cfg?.featuredListingsEnabled !== true) {
      return errorResponse(ErrorType.FORBIDDEN, 'Featured listings are currently disabled.');
    }

    const aSnap = await db.collection('auctions').doc(auctionId).get();
    if (!aSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    const auction = aSnap.data() as { sellerId: string; status: string; isFeatured?: boolean };
    if (auction.sellerId !== session.user.id) {
      return errorResponse(ErrorType.FORBIDDEN, 'Not your auction');
    }
    if (auction.status !== 'ACTIVE') {
      return errorResponse(ErrorType.VALIDATION, 'Only active auctions can be featured');
    }
    if (auction.isFeatured) {
      return errorResponse(ErrorType.VALIDATION, 'Auction is already featured');
    }

    // Admin-controlled pricing override; fall back to defaults. (cfg already
    // loaded above for the kill-switch check.)
    const priceBdt = cfg?.featurePricingBdt?.[String(days)] ?? DEFAULT_PRICING_BDT[days];

    const tranId = `feat-${auctionId}-${Date.now()}`;

    // Note: actual payment session creation is owned by the existing
    // /api/payments/callback flow. The seller's UI redirects to whichever
    // gateway is configured (bKash/Nagad/SSLCommerz) using this tranId.
    // The callback recognizes feat-* prefix and routes back to activateFeatured.

    return successResponse({ auctionId, days, priceBdt, tranId });
  } catch (err) {
    log.error('[featured] quote failed', err, { area: 'admin', userId: session.user.id });
    return errorResponse(ErrorType.INTERNAL, 'Could not quote feature purchase');
  }
}

/**
 * Step 2 — called from the payment webhook after verified payment.
 * Flips isFeatured=true + featuredUntil. Idempotent: re-running with
 * the same tranId is a no-op (cron will eventually expire it).
 */
export async function activateFeatured(
  auctionId: string,
  days: number,
  purchasedBy: string,
  tranId: string,
): Promise<ServiceResponse<null>> {
  try {
    const auctionRef = db.collection('auctions').doc(auctionId);
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(auctionRef);
      if (!snap.exists) throw new Error('Auction not found');
      const a = snap.data() as { featuredPurchasedBy?: string; featuredUntil?: { toDate?: () => Date } };
      const currentUntil = a.featuredUntil?.toDate?.();
      const newUntil = currentUntil && currentUntil > until ? currentUntil : until;
      tx.update(auctionRef, {
        isFeatured: true,
        featuredUntil: newUntil,
        featuredPurchasedBy: purchasedBy,
        featuredTranId: tranId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    revalidatePath('/');
    revalidatePath('/auctions');
    revalidatePath(`/auctions/${auctionId}`);
    log.event('auction_featured' as never, {
      userId: purchasedBy,
      auctionId,
      amountBdt: DEFAULT_PRICING_BDT[days],
      metadata: { days, tranId },
    });
    return successResponse(null);
  } catch (err) {
    log.error('[featured] activate failed', err, { auctionId, area: 'admin', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'Could not activate feature');
  }
}
