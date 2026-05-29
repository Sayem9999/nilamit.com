/**
 * Platform success-fee (commission) calculation — pure, so it can be
 * unit-tested outside the `server-only` auction-logic module.
 *
 * Tiered rates (when no admin flat rate is set):
 *   ≤ ৳10,000   → 2.5% + ৳20
 *   ≤ ৳150,000  → 1.5% + ৳20
 *   > ৳150,000  → 1.0% + ৳20
 *
 * A custom percentage (admin "flat custom rate") overrides the tiers entirely
 * and does NOT add the flat ৳20 component.
 */
export function calculateSuccessFee(
  finalPrice: number,
  customPercentage?: number | null,
): { fee: number; rate: number } {
  if (customPercentage !== undefined && customPercentage !== null) {
    const rate = customPercentage / 100;
    return { fee: Math.round(finalPrice * rate), rate };
  }
  if (finalPrice <= 10000) return { fee: Math.round(finalPrice * 0.025) + 20, rate: 0.025 };
  if (finalPrice <= 150000) return { fee: Math.round(finalPrice * 0.015) + 20, rate: 0.015 };
  return { fee: Math.round(finalPrice * 0.01) + 20, rate: 0.01 };
}
