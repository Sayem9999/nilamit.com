/**
 * SSLCommerz payment-session initiation.
 *
 * This is the *init* side of payments — it asks SSLCommerz for a hosted
 * checkout URL (`GatewayPageURL`) that the buyer is redirected to. The *verify*
 * side already exists: src/app/api/payments/callback verifies the IPN hash and
 * settles the escrow / activates the featured purchase.
 *
 * ENV-GATED (same pattern as search-engine.ts / pubsub.ts): without
 * `SSLCOMMERZ_STORE_ID` + `SSLCOMMERZ_STORE_PASSWORD` this no-ops and callers
 * get a clear "gateway not configured" result (HTTP 503 at the route). So you
 * can wire SSLCommerz later by just setting the two secrets — no code change.
 *
 *   SSLCOMMERZ_STORE_ID        merchant store id
 *   SSLCOMMERZ_STORE_PASSWORD  merchant store password (also verifies IPN hash)
 *   SSLCOMMERZ_SANDBOX="true"  use the sandbox host; otherwise production
 *
 * Docs: https://developer.sslcommerz.com/doc/v4/
 */

import 'server-only';
import { log } from '@/lib/logger';

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID;
const STORE_PASSWORD = process.env.SSLCOMMERZ_STORE_PASSWORD;
const SANDBOX = process.env.SSLCOMMERZ_SANDBOX === 'true';

const BASE_URL = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.nilamit.com';

const INIT_URL = SANDBOX
  ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
  : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

export function isSSLCommerzConfigured(): boolean {
  return !!STORE_ID && !!STORE_PASSWORD;
}

export interface CreateSessionInput {
  /** Unique transaction id the gateway echoes back to the callback. */
  tranId: string;
  /** Total in BDT. */
  amountBdt: number;
  productName: string;
  /** SSLCommerz `product_category` — free text (e.g. "featured", "escrow"). */
  productCategory: string;
  /** Carried through SSLCommerz `value_a`; the callback uses it to locate the
   *  escrow by automation token. For featured, this is the `feat_` tran id. */
  valueA: string;
  customer: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  /** "physical-goods" for shipped items, "non-physical-goods" for featured. */
  isPhysical?: boolean;
}

export type CreateSessionResult =
  | { ok: true; gatewayUrl: string; sessionKey?: string }
  | { ok: false; reason: 'not_configured' | 'gateway_error'; message: string };

/**
 * Create a hosted-checkout session. Returns the redirect URL on success.
 * Never throws — all failures come back as a structured result so the route
 * can map them to clean HTTP responses.
 */
export async function createPaymentSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  if (!isSSLCommerzConfigured()) {
    return { ok: false, reason: 'not_configured', message: 'Payment gateway is not configured' };
  }

  const callbackUrl = `${BASE_URL}/api/payments/callback`;

  const form = new URLSearchParams({
    store_id: STORE_ID as string,
    store_passwd: STORE_PASSWORD as string,
    total_amount: String(input.amountBdt),
    currency: 'BDT',
    tran_id: input.tranId,
    // IPN is the authoritative server-to-server verification → our callback.
    ipn_url: callbackUrl,
    // Browser redirects after the buyer finishes / aborts.
    success_url: `${BASE_URL}/dashboard?payment=success`,
    fail_url: `${BASE_URL}/dashboard?payment=failed`,
    cancel_url: `${BASE_URL}/dashboard?payment=cancelled`,
    // Custom passthrough — echoed back to the callback as `value_a`.
    value_a: input.valueA,
    product_name: input.productName.slice(0, 255),
    product_category: input.productCategory.slice(0, 100),
    product_profile: input.isPhysical ? 'physical-goods' : 'non-physical-goods',
    shipping_method: input.isPhysical ? 'YES' : 'NO',
    cus_name: (input.customer.name || 'Nilamit User').slice(0, 100),
    cus_email: (input.customer.email || 'noreply@nilamit.com').slice(0, 100),
    cus_phone: (input.customer.phone || '01700000000').slice(0, 20),
    cus_add1: 'N/A',
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
  });

  try {
    const res = await fetch(INIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      log.error('[sslcommerz] init HTTP error', { status: res.status, tranId: input.tranId, area: 'escrow', severity: 'warning' });
      return { ok: false, reason: 'gateway_error', message: `Gateway returned ${res.status}` };
    }

    const data = (await res.json()) as {
      status?: string;
      GatewayPageURL?: string;
      sessionkey?: string;
      failedreason?: string;
    };

    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      log.error('[sslcommerz] init not SUCCESS', { tranId: input.tranId, reason: data.failedreason, area: 'escrow', severity: 'warning' });
      return { ok: false, reason: 'gateway_error', message: data.failedreason || 'Gateway rejected the session' };
    }

    return { ok: true, gatewayUrl: data.GatewayPageURL, sessionKey: data.sessionkey };
  } catch (err) {
    log.error('[sslcommerz] init request failed', err, { tranId: input.tranId, area: 'escrow', severity: 'warning' });
    return { ok: false, reason: 'gateway_error', message: 'Could not reach payment gateway' };
  }
}
