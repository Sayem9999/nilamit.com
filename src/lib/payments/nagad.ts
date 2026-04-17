import type { PaymentAdapter, CreatePaymentInput, CreatePaymentResult, VerifyPaymentResult, WebhookPayload } from "./adapter";

const NAGAD_BASE = process.env.NAGAD_BASE_URL ?? "https://api.mynagad.com/api/dfs";

interface NagadInitResponse {
  paymentReferenceId?: string;
  callBackUrl?: string;
  status?: string;
  message?: string;
}

export class NagadAdapter implements PaymentAdapter {
  readonly provider = "nagad" as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.NAGAD_MERCHANT_ID &&
        process.env.NAGAD_MERCHANT_PRIVATE_KEY &&
        process.env.NAGAD_PG_PUBLIC_KEY,
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const res = await fetch(`${NAGAD_BASE}/check-out/initialize/${process.env.NAGAD_MERCHANT_ID}/${input.transactionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KM-Api-Version": "v-0.2.0",
        "X-KM-IP-V4": "0.0.0.0",
        "X-KM-Client-Type": "PC_WEB",
      },
      body: JSON.stringify({
        accountNumber: process.env.NAGAD_MERCHANT_ID,
        merchantId: process.env.NAGAD_MERCHANT_ID,
        orderId: input.transactionId,
        amount: input.amount.toFixed(2),
        currencyCode: "050",
        callbackUrl: input.callbackUrl,
      }),
    });

    const json = (await res.json()) as NagadInitResponse;
    if (!json.paymentReferenceId || !json.callBackUrl) {
      throw new Error(`Nagad init failed: ${json.message ?? res.statusText}`);
    }

    return {
      paymentId: json.paymentReferenceId,
      checkoutUrl: json.callBackUrl,
      provider: "nagad",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async verifyPayment(paymentId: string): Promise<VerifyPaymentResult> {
    const res = await fetch(`${NAGAD_BASE}/verify/payment/${paymentId}`, {
      headers: { "Content-Type": "application/json" },
    });
    const json = (await res.json()) as Record<string, unknown>;
    const status = String(json.status ?? "");
    const success = status === "Success";
    return {
      paymentId,
      providerRef: String(json.issuerPaymentRefNo ?? paymentId),
      status: success ? "SUCCESS" : status === "Pending" ? "PENDING" : "FAILED",
      amount: Number(json.amount ?? 0),
      paidAt: success ? new Date() : undefined,
    };
  }

  async parseWebhook(body: unknown): Promise<WebhookPayload> {
    const b = (body || {}) as Record<string, unknown>;
    const status = String(b.status ?? "");
    return {
      provider: "nagad",
      paymentId: String(b.paymentRefId ?? b.paymentReferenceId ?? ""),
      transactionId: String(b.orderId ?? b.merchantOrderId ?? ""),
      providerRef: String(b.issuerPaymentRefNo ?? b.paymentRefId ?? ""),
      status: status === "Success" ? "SUCCESS" : status === "Pending" ? "PENDING" : "FAILED",
      amount: Number(b.amount ?? 0),
      signatureOk: true,
      raw: body,
    };
  }
}
