import { NextRequest, NextResponse } from 'next/server';
import crypto, { timingSafeEqual } from 'crypto';
import { PaymentService, type PaymentProvider } from '@/services/payment/payment-service';
import { activateFeaturedFromPayment } from '@/lib/featured-service';
import { isFeaturedTranId } from '@/services/finance/featured';
import { log } from '@/lib/logger';

const PAYMENT_PROVIDERS: readonly PaymentProvider[] = ['bkash', 'nagad', 'sslcommerz', 'card'];

function isPaymentProvider(v: unknown): v is PaymentProvider {
  return typeof v === 'string' && (PAYMENT_PROVIDERS as readonly string[]).includes(v);
}

/** Constant-time secret comparison — avoids leaking the webhook secret via timing. */
function secretEquals(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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
      // SECURITY (audit finding C4): the JSON branch releases escrow on a shared
      // static secret alone — there is no gateway signature here. It is a
      // dev/test + manual-automation affordance and MUST NOT be a production
      // money-release path. Disabled in production unless an operator explicitly
      // opts in via PAYMENT_WEBHOOK_ALLOW_PROD, so a leaked secret can't drain
      // escrow on the live site by default.
      const jsonReleaseAllowed =
        process.env.NODE_ENV !== 'production' ||
        process.env.PAYMENT_WEBHOOK_ALLOW_PROD === 'true';

      if (!jsonReleaseAllowed) {
        log.warn('[PaymentCallback] JSON release branch invoked in production — blocked');
        return new NextResponse('Not Found', { status: 404 });
      }

      const body = await req.json();
      const { transactionId, automationToken, amount, provider, secret } = body;

      // Check developer webhook secret (constant-time compare)
      const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (expectedSecret && secretEquals(secret, expectedSecret)) {
        if (!automationToken || !transactionId || !amount || !provider) {
          return new NextResponse('Bad Request', { status: 400 });
        }
        if (!isPaymentProvider(provider)) {
          return NextResponse.json({ success: false, error: 'Unknown payment provider' }, { status: 400 });
        }

        // Featured-listing purchases route to activation, not escrow release.
        if (isFeaturedTranId(transactionId)) {
          const feat = await activateFeaturedFromPayment(transactionId, Number(amount), provider);
          return feat.success
            ? NextResponse.json({ success: true, message: 'Featured activated' })
            : NextResponse.json({ success: false, error: feat.error?.message }, { status: 400 });
        }

        const res = await PaymentService.verifyAndReleaseEscrow(
          automationToken,
          transactionId,
          Number(amount),
          provider
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

    const { status, tran_id, val_id, amount, value_a } = payload;

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

    // ─── Featured-listing branch ──────────────────────────────────────
    // A `feat_` transaction id is a self-serve featured purchase, not an
    // escrow advance. Signature is already verified above, so activation is
    // safe to run here.
    if (isFeaturedTranId(tran_id)) {
      const feat = await activateFeaturedFromPayment(tran_id, Number(amount), 'sslcommerz');
      if (feat.success) {
        log.info('[PaymentCallback] Featured listing activated', { tran_id, val_id });
        return NextResponse.json({ status: 'OK' });
      }
      log.error('[PaymentCallback] Featured activation failed', feat.error?.message);
      return NextResponse.json({ error: feat.error?.message }, { status: 400 });
    }

    // ─── Escrow branch ─────────────────────────────────────────────────
    // Locate the escrow by its high-entropy automation token (audit finding
    // C2). The init request seeds that token into SSLCommerz `value_a`, which
    // the gateway echoes back here. We fall back to tran_id only for legacy
    // sessions created before the token migration.
    const automationToken = value_a || tran_id;

    // card_type is the card brand (VISA / MASTER / bKash-via-SSL etc.); it is
    // NOT an MFS provider. Record the rail as 'sslcommerz' so the ledger stays
    // clean (audit finding C3). Amount is reconciled against the escrow inside
    // verifyAndReleaseEscrow (audit finding C1).
    const res = await PaymentService.verifyAndReleaseEscrow(
      automationToken,
      tran_id,
      Number(amount),
      'sslcommerz'
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
