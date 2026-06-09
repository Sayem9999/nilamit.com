/**
 * POST /api/courier/webhook
 *
 * Receives delivery-status updates from the courier and appends them to the
 * auction's logistics history. Authenticated by a shared secret
 * (COURIER_WEBHOOK_SECRET) in the `X-Webhook-Secret` header — the courier is
 * configured to send it.
 *
 * Body (Steadfast-style): {
 *   notification_type, consignment_id, invoice, cod_amount,
 *   status / delivery_status, ...
 * }
 *
 * We locate the auction by the `invoice` field (= our NLM tracking id, which
 * equals logistics.trackingId), map the courier status to LogisticsStatus, and
 * record it. Returns 200 on success so the courier stops retrying.
 *
 * No-op safe: if COURIER_WEBHOOK_SECRET isn't set, every call is rejected 401.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateLogisticsStatus, type LogisticsStatus } from '@/lib/logistics';
import { mapCourierStatus, isCourierWebhookSecretValid } from '@/lib/courier';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (!isCourierWebhookSecretValid(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invoice = String(body.invoice ?? '');
  const rawStatus = String(body.status ?? body.delivery_status ?? '');
  if (!invoice) {
    return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
  }

  const mapped: LogisticsStatus = mapCourierStatus(rawStatus);

  try {
    // invoice == logistics.trackingId. Find the owning auction.
    const snap = await db
      .collection('auctions')
      .where('logistics.trackingId', '==', invoice)
      .limit(1)
      .get();

    if (snap.empty) {
      log.warn('[courier-webhook] no auction for invoice', { invoice, area: 'logistics' });
      // 200 so the courier doesn't hammer retries for an unknown invoice.
      return NextResponse.json({ status: 'ignored' });
    }

    const auctionId = snap.docs[0].id;
    await updateLogisticsStatus(auctionId, mapped, `Courier update: ${rawStatus || 'status changed'}`);

    log.info('[courier-webhook] logistics updated', { auctionId, invoice, mapped });
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    log.error('[courier-webhook] processing failed', err, { invoice, area: 'logistics', severity: 'warning' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
