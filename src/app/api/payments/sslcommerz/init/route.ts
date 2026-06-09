/**
 * POST /api/payments/sslcommerz/init
 *
 * Creates a hosted-checkout session and returns the redirect URL. This is the
 * payment *init* counterpart to /api/payments/callback (which verifies + settles).
 *
 * Body: { purpose: 'featured', auctionId: string, days: number }
 *   (escrow advances are a planned follow-up — see docs/PAYMENTS.md.)
 *
 * Responses:
 *   200 { gatewayUrl }                  → redirect the buyer here
 *   503 { error, code:'GATEWAY_OFF' }   → SSLCommerz not configured yet
 *   4xx { error }                       → auth / validation / ownership failure
 *
 * Until SSLCOMMERZ_STORE_ID + SSLCOMMERZ_STORE_PASSWORD are set this returns
 * 503 by design — the rest of the app is unaffected.
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter } from '@/lib/ratelimit';
import { createPaymentSession, isSSLCommerzConfigured } from '@/lib/sslcommerz';
import { initiateFeaturedPurchase } from '@/actions/featured';
import { initEscrowGatewayPayment } from '@/actions/escrow';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fail-open limiter is acceptable here: this only mints a checkout session,
  // not a money movement. The authoritative settlement is the signed callback.
  const gate = await apiLimiter.limit(`pay_init_${session.user.id}`);
  if (!gate.success) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  if (!isSSLCommerzConfigured()) {
    return NextResponse.json(
      { error: 'Payment gateway is not enabled yet.', code: 'GATEWAY_OFF' },
      { status: 503 },
    );
  }

  let body: { purpose?: string; auctionId?: string; days?: number; transactionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Common: contact details for the gateway customer block.
  let phone: string | null = null;
  try {
    const u = await db.collection('users').doc(session.user.id).get();
    phone = (u.data()?.phoneNumber as string | undefined) ?? null;
  } catch { /* non-fatal — gateway accepts a placeholder */ }
  const customer = { name: session.user.name, email: session.user.email, phone };

  // ── Featured listing ────────────────────────────────────────────────
  if (body.purpose === 'featured') {
    const init = await initiateFeaturedPurchase(String(body.auctionId), Number(body.days));
    if (!init.success || !init.data) {
      return NextResponse.json({ error: init.error?.message || 'Could not start purchase' }, { status: 400 });
    }
    const result = await createPaymentSession({
      tranId: init.data.tranId,
      amountBdt: init.data.amountBdt,
      productName: 'Featured listing promotion',
      productCategory: 'featured',
      valueA: init.data.tranId, // callback detects feat_ ids and activates
      customer,
      isPhysical: false,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.reason === 'not_configured' ? 503 : 502 });
    }
    log.info('[pay-init] featured session created', { auctionId: init.data.auctionId, userId: session.user.id });
    return NextResponse.json({ gatewayUrl: result.gatewayUrl });
  }

  // ── Escrow advance ──────────────────────────────────────────────────
  if (body.purpose === 'escrow') {
    const init = await initEscrowGatewayPayment(String(body.transactionId));
    if (!init.success || !init.data) {
      return NextResponse.json({ error: init.error?.message || 'Could not start payment' }, { status: 400 });
    }
    const result = await createPaymentSession({
      // tran_id == value_a == automationToken: the callback locates the escrow
      // by automationToken (and it isn't a feat_ id, so it routes to escrow).
      tranId: init.data.automationToken,
      amountBdt: init.data.amountBdt,
      productName: 'Nilamit escrow advance',
      productCategory: 'escrow',
      valueA: init.data.automationToken,
      customer,
      isPhysical: true,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.reason === 'not_configured' ? 503 : 502 });
    }
    log.info('[pay-init] escrow session created', { transactionId: body.transactionId, userId: session.user.id });
    return NextResponse.json({ gatewayUrl: result.gatewayUrl });
  }

  return NextResponse.json({ error: 'Unsupported payment purpose' }, { status: 400 });
}
