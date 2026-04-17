export type PaymentProvider = "bkash" | "nagad" | "sandbox";

export interface CreatePaymentInput {
  transactionId: string;
  amount: number;
  currency?: "BDT";
  payerReference?: string;
  callbackUrl: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  checkoutUrl: string;
  provider: PaymentProvider;
  expiresAt?: Date;
}

export interface VerifyPaymentResult {
  paymentId: string;
  providerRef: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  amount: number;
  paidAt?: Date;
}

export interface WebhookPayload {
  provider: PaymentProvider;
  paymentId: string;
  transactionId: string;
  providerRef: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  amount: number;
  signatureOk: boolean;
  raw: unknown;
}

export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(paymentId: string): Promise<VerifyPaymentResult>;
  parseWebhook(body: unknown, headers: Record<string, string>): Promise<WebhookPayload>;
}
