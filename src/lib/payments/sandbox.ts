import type { PaymentAdapter, CreatePaymentInput, CreatePaymentResult, VerifyPaymentResult, WebhookPayload } from "./adapter";

export class SandboxAdapter implements PaymentAdapter {
  readonly provider = "sandbox" as const;

  isConfigured(): boolean {
    return true;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const paymentId = `SBX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return {
      paymentId,
      checkoutUrl: `${input.callbackUrl}?paymentID=${paymentId}&status=success&amount=${input.amount}&tx=${input.transactionId}`,
      provider: "sandbox",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async verifyPayment(paymentId: string): Promise<VerifyPaymentResult> {
    return {
      paymentId,
      providerRef: paymentId,
      status: "SUCCESS",
      amount: 0,
      paidAt: new Date(),
    };
  }

  async parseWebhook(body: unknown): Promise<WebhookPayload> {
    const b = (body || {}) as Record<string, unknown>;
    return {
      provider: "sandbox",
      paymentId: String(b.paymentId ?? ""),
      transactionId: String(b.transactionId ?? ""),
      providerRef: String(b.providerRef ?? b.paymentId ?? ""),
      status: (b.status as "SUCCESS" | "FAILED" | "PENDING") ?? "SUCCESS",
      amount: Number(b.amount ?? 0),
      signatureOk: true,
      raw: body,
    };
  }
}
