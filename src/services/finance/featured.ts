/**
 * Featured-listing pricing + transaction-id codec.
 *
 * PURE module (no `server-only`, no I/O) so it's unit-testable and importable
 * from both the Server Action and the payment-callback route.
 *
 * A "featured" purchase promotes a seller's auction to the top of listings
 * (the reader already filters `isFeatured`) for a fixed window. Sellers pay
 * through the same gateway as escrow advances; we distinguish the two by a
 * `feat_` transaction-id prefix so the single payment webhook can route it.
 *
 * Transaction id format:  feat_{auctionId}_{days}_{nonce}
 *   - auctionId is a Firestore auto-id (alphanumeric, no separators) so the
 *     underscore split is unambiguous.
 *   - days is one of the FEATURED_TIERS keys.
 *   - nonce is random hex — also the idempotency key for activation.
 */

export interface FeaturedTier {
  days: number;
  priceBdt: number;
  label: string;
}

/** Self-serve featured tiers. Tune freely — pricing is pure config. */
export const FEATURED_TIERS: readonly FeaturedTier[] = [
  { days: 3, priceBdt: 150, label: '3 days' },
  { days: 7, priceBdt: 300, label: '7 days' },
  { days: 14, priceBdt: 500, label: '14 days' },
] as const;

export function getFeaturedTier(days: number): FeaturedTier | null {
  return FEATURED_TIERS.find((t) => t.days === days) ?? null;
}

/** Price quote for a given duration. Returns null for an unknown tier. */
export function quoteFeatured(days: number): { days: number; priceBdt: number } | null {
  const tier = getFeaturedTier(days);
  return tier ? { days: tier.days, priceBdt: tier.priceBdt } : null;
}

const PREFIX = 'feat';

export function buildFeaturedTranId(auctionId: string, days: number, nonce: string): string {
  return `${PREFIX}_${auctionId}_${days}_${nonce}`;
}

export interface ParsedFeaturedTran {
  auctionId: string;
  days: number;
  nonce: string;
}

export function isFeaturedTranId(tranId: string | undefined | null): boolean {
  return typeof tranId === 'string' && tranId.startsWith(`${PREFIX}_`);
}

/**
 * Parse + validate a featured transaction id. Returns null if malformed or the
 * duration isn't a known tier — so a forged/garbage id can't activate anything.
 */
export function parseFeaturedTranId(tranId: string): ParsedFeaturedTran | null {
  if (!isFeaturedTranId(tranId)) return null;
  const parts = tranId.split('_');
  // feat _ auctionId _ days _ nonce  → exactly 4 parts
  if (parts.length !== 4) return null;
  const [, auctionId, daysRaw, nonce] = parts;
  const days = Number(daysRaw);
  if (!auctionId || !nonce || !Number.isInteger(days)) return null;
  if (!getFeaturedTier(days)) return null;
  return { auctionId, days, nonce };
}
