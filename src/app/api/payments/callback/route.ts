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

    // ─── Featured-listing purchase branch ──────────────────────────────
    // Featured purchases use tran_id format `feat-{auctionId}-{ts}` (see
    // quoteFeaturedPurchase in src/actions/featured.ts). Route them to
    // activateFeatured instead of the escrow pipeline.
    if (tran_id.startsWith('feat-')) {
      const match = tran_id.match(/^feat-(.+)-(\d+)$/);
      if (!match) {
        log.warn('[PaymentCallback] Unparseable feat- tran_id', { tran_id });
        return NextResponse.json({ status: 'OK' });
      }
      const auctionId = match[1];

      // Look up the purchase quote to find duration + buyer (the quote
      // doesn't persist server-side yet, so we infer days from amount.
      // TODO: persist quoteId → {days, sellerId, priceBdt} when we have
      // a transient purchases collection. For now, look up auction +
      // assume days from the amount paid).
      const amt = Number(amount);
      const days = amt >= 250 ? 7 : amt >= 120 ? 3 : 1;

      const aSnap = await (await import('@/lib/db')).db
        .collection('auctions')
        .doc(auctionId)
        .get();
      const sellerId = (aSnap.data() as { sellerId?: string } | undefined)?.sellerId;
      if (!sellerId) {
        log.warn('[PaymentCallback] feat- auction missing or sellerId', { auctionId });
        return NextResponse.json({ status: 'OK' });
      }

      const { activateFeatured } = await import('@/actions/featured');
      const featResult = await activateFeatured(auctionId, days, sellerId, tran_id);
      if (featResult.success) {
        log.info('[PaymentCallback] Featured-listing activated', { auctionId, days, tran_id, amt });
        return NextResponse.json({ status: 'OK', kind: 'featured' });
      } else {
        log.error('[PaymentCallback] Featured activation failed', featResult.error?.message, { auctionId });
        return NextResponse.json({ error: featResult.error?.message }, { status: 500 });
      }
    }

    // ─── Escrow branch (default for non-feat- tranIds) ─────────────────
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
