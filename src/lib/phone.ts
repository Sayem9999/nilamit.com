/**
 * Bangladesh phone-number normalization. PURE module (no server-only, no I/O)
 * so both the client form and the server action share one canonicalization and
 * it stays unit-testable.
 *
 * Canonical form: E.164 — `+8801XXXXXXXXX` (13 chars, operator digit 3-9).
 */

const BD_MOBILE = /^\+8801[3-9]\d{8}$/;

/**
 * Normalize common BD inputs to E.164, or null if it isn't a valid BD mobile:
 *   "01712345678"      → "+8801712345678"
 *   "8801712345678"    → "+8801712345678"
 *   "+880 1712-345678" → "+8801712345678"
 *   "1712345678"       → "+8801712345678"
 */
export function normalizeBdPhone(input: string): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  if (digits.startsWith('880')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  // What remains must be the 10-digit mobile part starting with 1.
  if (!/^1[3-9]\d{8}$/.test(digits)) return null;

  const e164 = `+880${digits}`;
  return BD_MOBILE.test(e164) ? e164 : null;
}

/** Mask for display: +8801712345678 → +88017•••••678 */
export function maskPhone(e164: string): string {
  if (e164.length < 8) return e164;
  return `${e164.slice(0, 6)}•••••${e164.slice(-3)}`;
}
