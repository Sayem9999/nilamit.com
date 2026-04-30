import { NextResponse } from 'next/server';
import { PaymentService } from '@/services/payment/payment-service';
import { log } from '@/lib/logger';

/**
 * MFS Callback Route (bKash/Nagad Webhook Stub)
 * In production, this would be secured by provider-specific signatures.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionId, automationToken, amount, provider, secret } = body;

    // 1. Basic Security Stub
    if (secret !== process.env.PAYMENT_WEBHOOK_SECRET) {
      log.warn('Payment: Unauthorized webhook attempt', { provider });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!automationToken || !transactionId || !amount || !provider) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    // 2. Process via Service
    const res = await PaymentService.verifyAndReleaseEscrow(
      automationToken,
      transactionId,
      Number(amount),
      provider as 'bkash' | 'nagad'
    );

    if (res.success) {
      return NextResponse.json({ success: true, message: 'Escrow HELD' });
    } else {
      return NextResponse.json({ success: false, error: res.error?.message }, { status: 404 });
    }
  } catch (err) {
    log.error('Payment: Webhook handler failed', err);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
