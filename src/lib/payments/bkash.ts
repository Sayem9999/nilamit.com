import type { PaymentAdapter, CreatePaymentInput, CreatePaymentResult, VerifyPaymentResult, WebhookPayload } from "./adapter";

interface BkashTokenResponse {
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  statusCode?: string;
  statusMessage?: string;
}

interface BkashCreateResponse {
  paymentID?: string;
  bkashURL?: string;
  statusCode?: string;
  statusMessage?: string;
  merchantInvoiceNumber?: string;
}

interface BkashExecuteResponse {
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  statusCode?: string;
  statusMessage?: string;
}

const BKASH_BASE = process.env.BKASH_BASE_URL ?? "https://tokenized.sandbox.bka.sh/v1.2.0-beta";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBkashToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${BKASH_BASE}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: process.env.BKASH_USERNAME ?? "",
      password: process.env.BKASH_PASSWORD ?? "",
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY ?? "",
      app_secret: process.env.BKASH_APP_SECRET ?? "",
    }),
  });

  const json = (await res.json()) as BkashTokenResponse;
  if (!json.id_token) {
    throw new Error(`bKash token grant failed: ${json.statusMessage ?? res.statusText}`);
  }

  cachedToken = {
    token: json.id_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function bkashHeaders(): Promise<Record<string, string>> {
  const token = await getBkashToken();
  return {
    "Content-Type": "application/json",
    Authorization: token,
    "X-APP-Key": process.env.BKASH_APP_KEY ?? "",
  };
}

export class BkashAdapter implements PaymentAdapter {
  readonly provider = "bkash" as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.BKASH_APP_KEY &&
        process.env.BKASH_APP_SECRET &&
        process.env.BKASH_USERNAME &&
        process.env.BKASH_PASSWORD,
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const headers = await bkashHeaders();
    const res = await fetch(`${BKASH_BASE}/tokenized/checkout/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "0011",
        payerReference: input.payerReference ?? input.transactionId,
        callbackURL: input.callbackUrl,
        amount: input.amount.toFixed(2),
        currency: input.currency ?? "BDT",
        intent: "sale",
        merchantInvoiceNumber: input.transactionId,
      }),
    });

    const json = (await res.json()) as BkashCreateResponse;
    if (!json.paymentID || !json.bkashURL) {
      throw new Error(`bKash create failed: ${json.statusMessage ?? res.statusText}`);
    }

    return {
      paymentId: json.paymentID,
      checkoutUrl: json.bkashURL,
      provider: "bkash",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async verifyPayment(paymentId: string): Promise<VerifyPaymentResult> {
    const headers = await bkashHeaders();
    const res = await fetch(`${BKASH_BASE}/tokenized/checkout/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentID: paymentId }),
    });

    const json = (await res.json()) as BkashExecuteResponse;
    const ok = json.transactionStatus === "Completed" && json.trxID;

    return {
      paymentId,
      providerRef: json.trxID ?? paymentId,
      status: ok ? "SUCCESS" : json.transactionStatus === "Initiated" ? "PENDING" : "FAILED",
      amount: Number(json.amount ?? 0),
      paidAt: ok ? new Date() : undefined,
    };
  }

  async parseWebhook(body: unknown): Promise<WebhookPayload> {
    const b = (body || {}) as Record<string, unknown>;
    const status = String(b.transactionStatus ?? b.status ?? "");
    return {
      provider: "bkash",
      paymentId: String(b.paymentID ?? b.paymentId ?? ""),
      transactionId: String(b.merchantInvoiceNumber ?? b.transactionId ?? ""),
      providerRef: String(b.trxID ?? b.paymentID ?? ""),
      status: status === "Completed" ? "SUCCESS" : status === "Initiated" ? "PENDING" : "FAILED",
      amount: Number(b.amount ?? 0),
      signatureOk: true,
      raw: body,
    };
  }
}
