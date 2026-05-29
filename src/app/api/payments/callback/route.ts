import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PaymentService } from '@/services/payment/payment-service';
import { log } from '@/lib/logger';

/**
 * Verify SSLCommerz checksum signature
 */
function verifySSLCommerzSignature(payload: Record<string, string>, storePasswordMd5: string): boolean {
  const { verify_sign, verify_key } = payload;
  if (!verify_sign || !verify_key) return false;

  const keyList = verify_key.split(',');
  const sortedPayload: Record<string, string> = {};
  
  keyList.forEach((key) => {
    if (payload[key] !== undefined) {
      sortedPayload[key] = payload[key];
    }
  });

  sortedPayload['store_passwd'] = storePasswordMd5;

  const queryString = Object.keys(sortedPayload)
    .sort()
    .map((key) => `${key}=${sortedPayload[key]}`)
    .join('&');

  const hashedValue = crypto.createHash('md5').update(queryString).digest('hex');
  return hashedValue === verify_sign;
}

/**
 * Payments Callback Route (SSLCommerz & bKash Callback Webhook)
 * Supports both manual developer webhook test triggers and real production signatures.
 */
export async function POST(req: NextRequest) {
  try {
    // Check if the request is a JSON trigger (e.g. tests or manual automation payload)
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { transactionId, automationToken, amount, provider, secret } = body;

      // Check developer webhook secret
      if (secret === process.env.PAYMENT_WEBHOOK_SECRET && process.env.PAYMENT_WEBHOOK_SECRET) {
        if (!automationToken || !transactionId || !amount || !provider) {
          return new NextResponse('Bad Request', { status: 400 });
        }

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
      }
    }

    // Otherwise, parse standard application/x-www-form-urlencoded payment callback
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    const { status, tran_id, val_id, amount, card_type } = payload;

    if (status !== 'VALID') {
      log.warn('[PaymentCallback] Ignored non-valid callback status', { tran_id, status });
      return NextResponse.json({ status: 'OK' });
    }

    const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
    if (!storePassword) {
      log.error('[PaymentCallback] Config missing SSLCOMMERZ_STORE_PASSWORD');
      return NextResponse.json({ error: 'Config missing store password' }, { status: 500 });
    }
    const storePassMd5 = crypto.createHash('md5').update(storePassword).digest('hex');

    if (!verifySSLCommerzSignature(payload, storePassMd5)) {
      log.error('[PaymentCallback] Signature verification failed!', { tran_id });
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
    }

    // ─── Escrow branch ─────────────────────────────────────────────────
    // Release escrow atomically using the payment service
    const res = await PaymentService.verifyAndReleaseEscrow(
      tran_id, // using transactional ID as the automation token target
      tran_id,
      Number(amount),
      (card_type || 'sslcommerz') as 'bkash' | 'nagad'
    );

    if (res.success) {
      log.info('[PaymentCallback] Escrow successfully transitioned to HELD', { tran_id, val_id });
      return NextResponse.json({ status: 'OK' });
    } else {
      log.error('[PaymentCallback] Escrow transition failed', res.error?.message);
      return NextResponse.json({ error: res.error?.message }, { status: 404 });
    }
  } catch (error) {
    log.error('[PaymentCallback] Webhook processing failed', error);
    return new NextResponse('Internal Webhook Error', { status: 500 });
  }
}
