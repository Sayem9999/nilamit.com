import type { PaymentAdapter, PaymentProvider } from "./adapter";
import { SandboxAdapter } from "./sandbox";
import { BkashAdapter } from "./bkash";
import { NagadAdapter } from "./nagad";

export type { PaymentAdapter, PaymentProvider, CreatePaymentInput, CreatePaymentResult, VerifyPaymentResult, WebhookPayload } from "./adapter";

const sandbox = new SandboxAdapter();
const bkash = new BkashAdapter();
const nagad = new NagadAdapter();

export function getPaymentAdapter(provider?: PaymentProvider | string): PaymentAdapter {
  const p = (provider ?? process.env.PAYMENT_PROVIDER ?? "").toLowerCase();

  if (p === "bkash" && bkash.isConfigured()) return bkash;
  if (p === "nagad" && nagad.isConfigured()) return nagad;
  if (p === "sandbox") return sandbox;

  if (bkash.isConfigured()) return bkash;
  if (nagad.isConfigured()) return nagad;
  return sandbox;
}

export function getAdapterByProvider(provider: string): PaymentAdapter | null {
  const p = provider.toLowerCase();
  if (p === "bkash") return bkash;
  if (p === "nagad") return nagad;
  if (p === "sandbox") return sandbox;
  return null;
}
