/**
 * Featured-listing activation — the money-in side of the featured purchase.
 *
 * Called by the payment webhook ([api/payments/callback]) when a verified
 * payment arrives with a `feat_` transaction id. Mirrors the escrow path:
 * the route verifies the gateway signature, this module does the
 * transactional + idempotent state change.
 *
 * Idempotency: keyed by the tran-id `nonce` via `featuredActivations/{nonce}`.
 * A replayed webhook for an already-activated purchase is a no-op success,
 * never a double-extension.
 *
 * Amount guard: the paid amount must be >= the tier price, so a tampered
 * low-value payment can't unlock a longer window.
 */

import 'server-only';
import { db } from '@/lib/db';
import { FieldValue } from 'firebase-admin/firestore';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { getFeaturedTier, parseFeaturedTranId } from '@/services/finance/featured';
import { updateAuctionInIndex } from '@/lib/search-engine';
import type { PaymentProvider } from '@/services/payment/payment-service';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function activateFeaturedFromPayment(
  tranId: string,
  amount: number,
  provider: PaymentProvider,
): Promise<ServiceResponse<{ auctionId: string; featuredUntil: Date }>> {
  const parsed = parseFeaturedTranId(tranId);
  if (!parsed) return errorResponse(ErrorType.VALIDATION, 'Malformed featured transaction id');

  const tier = getFeaturedTier(parsed.days);
  if (!tier) return errorResponse(ErrorType.VALIDATION, 'Unknown featured tier');

  if (!Number.isFinite(amount) || amount < tier.priceBdt) {
    log.warn('[featured] underpaid activation rejected', { tranId, amount, expected: tier.priceBdt, area: 'admin', severity: 'warning' });
    return errorResponse(ErrorType.VALIDATION, 'Paid amount below featured tier price');
  }

  try {
    const featuredUntil = await db.runTransaction(async (tx) => {
      const activationRef = db.collection('featuredActivations').doc(parsed.nonce);
      const auctionRef = db.collection('auctions').doc(parsed.auctionId);

      const [activationSnap, auctionSnap] = await Promise.all([
        tx.get(activationRef),
        tx.get(auctionRef),
      ]);

      // Replayed webhook — return the already-set window, don't extend again.
      if (activationSnap.exists) {
        const prev = auctionSnap.data()?.featuredUntil;
        const prevDate = prev?.toDate ? prev.toDate() : (prev ? new Date(prev) : new Date());
        return prevDate as Date;
      }

      if (!auctionSnap.exists) throw new Error('Auction not found');
      const a = auctionSnap.data()!;
      if (a.status !== 'ACTIVE') throw new Error(`Cannot feature a ${a.status} auction`);

      const now = Date.now();
      // Extend from the later of now / existing featuredUntil so stacking adds time.
      const existing = a.featuredUntil?.toDate ? a.featuredUntil.toDate().getTime() : 0;
      const base = Math.max(now, existing);
      const until = new Date(base + parsed.days * DAY_MS);

      tx.update(auctionRef, {
        isFeatured: true,
        featuredUntil: until,
        featuredPurchasedBy: a.sellerId,
        updatedAt: new Date(),
      });

      tx.set(activationRef, {
        auctionId: parsed.auctionId,
        sellerId: a.sellerId,
        days: parsed.days,
        amount,
        provider,
        tranId,
        createdAt: FieldValue.serverTimestamp(),
      });

      return until;
    });

    // Reflect the featured flag in the search index (no-op until provisioned).
    updateAuctionInIndex(parsed.auctionId, { isFeatured: true })
      .catch((e) => log.warn('[featured] search reindex failed', { auctionId: parsed.auctionId, error: String(e) }));

    log.info('[featured] activated', { auctionId: parsed.auctionId, days: parsed.days, until: featuredUntil.toISOString() });
    return successResponse({ auctionId: parsed.auctionId, featuredUntil });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Featured activation failed';
    log.error('[featured] activation failed', err, { tranId, area: 'admin', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, msg);
  }
}
