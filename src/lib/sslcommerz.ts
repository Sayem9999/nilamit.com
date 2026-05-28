/**
 * SSLCommerz payment gateway client (server-only).
 *
 * Two endpoints:
 *   - initSession()   — creates a payment session, returns redirect URL
 *   - verifyIPN()     — validates incoming webhook hash before trusting payload
 *
 * SSLCommerz is the dominant card+bank gateway in Bangladesh — bKash and
 * Nagad handle wallet, SSLCommerz handles Visa/Mastercard/Amex + net banking.
 *
 * Env vars (set in Secret Manager for prod):
 *   SSLCOMMERZ_STORE_ID
 *   SSLCOMMERZ_STORE_PASSWORD
 *   SSLCOMMERZ_SANDBOX     ("true" for sandbox, anything else = production)
 *
 * Without these set, isConfigured() returns false and routes 503 — bKash/Nagad
 * keep working independently.
 */

import "server-only";
import { createHash } from "crypto";
import { log } from "@/lib/logger";

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID;
const STORE_PASSWORD = process.env.SSLCOMMERZ_STORE_PASSWORD;
const IS_SANDBOX = process.env.SSLCOMMERZ_SANDBOX === "true";

const BASE_URL = IS_SANDBOX
  ? "https://sandbox.sslcommerz.com"
  : "https://securepay.sslcommerz.com";

export function isConfigured(): boolean {
  return !!STORE_ID && !!STORE_PASSWORD;
}

export interface InitSessionInput {
  /** Internal transaction reference. Echoed back in IPN. */
  tranId: string;
  amount: number;
  currency?: "BDT";
  productCategory: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface InitSessionResult {
  status: string;
  GatewayPageURL?: string;
  failedreason?: string;
}

export async function initSession(input: InitSessionInput): Promise<InitSessionResult> {
  if (!isConfigured()) {
    throw new Error("SSLCommerz is not configured. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.");
  }

  const body = new URLSearchParams({
    store_id: STORE_ID!,
    store_passwd: STORE_PASSWORD!,
    total_amount: String(input.amount),
    currency: input.currency ?? "BDT",
    tran_id: input.tranId,
    product_category: input.productCategory,
    product_name: input.productName,
    product_profile: "general",
    cus_name: input.customerName,
    cus_email: input.customerEmail,
    cus_phone: input.customerPhone,
    cus_add1: input.customerAddress,
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    success_url: input.successUrl,
    fail_url: input.failUrl,
    cancel_url: input.cancelUrl,
    ipn_url: input.ipnUrl,
  });

  const res = await fetch(`${BASE_URL}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    log.error("[SSLCommerz] initSession HTTP error", new Error(text), {
      area: "escrow",
      severity: "warning",
    });
    throw new Error(`SSLCommerz HTTP ${res.status}: ${text}`);
  }

  return (await res.json()) as InitSessionResult;
}

/**
 * IPN payload from SSLCommerz includes a `verify_sign` and `verify_key`.
 * Recompute the signature locally using the keys listed in verify_key and
 * the store password — if it doesn't match, the IPN is forged. Always run
 * this before trusting any IPN payload.
 *
 * Per SSLCommerz spec: hash = md5(joinedKVPairs + '&store_passwd=' + md5(storePw)).
 */
export function verifyIPN(payload: Record<string, string>): boolean {
  if (!isConfigured()) return false;
  const verifySign = payload.verify_sign;
  const verifyKey = payload.verify_key;
  if (!verifySign || !verifyKey) return false;

  const keys = verifyKey.split(",").sort();
  const storePwHash = createHash("md5").update(STORE_PASSWORD!).digest("hex");

  const parts = keys.map((k) => `${k}=${payload[k] ?? ""}`);
  parts.push(`store_passwd=${storePwHash}`);
  const calc = createHash("md5").update(parts.sort().join("&")).digest("hex");

  return calc === verifySign;
}

/**
 * After a user is redirected back to success_url, call this to confirm the
 * transaction is actually paid (don't trust the redirect alone — it can be
 * forged by the user).
 */
export async function validatePayment(tranId: string): Promise<{ valid: boolean; status?: string; amount?: number }> {
  if (!isConfigured()) return { valid: false };
  const url = `${BASE_URL}/validator/api/validationserverAPI.php?tran_id=${encodeURIComponent(tranId)}&store_id=${STORE_ID}&store_passwd=${STORE_PASSWORD}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return { valid: false };

  const body = (await res.json()) as { status?: string; amount?: string };
  const valid = body.status === "VALID" || body.status === "VALIDATED";
  return { valid, status: body.status, amount: body.amount ? Number(body.amount) : undefined };
}
