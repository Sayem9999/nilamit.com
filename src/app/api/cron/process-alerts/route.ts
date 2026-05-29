import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';

/**
 * POST /api/cron/process-alerts
 *
 * Evaluates user-created price alerts and fires a one-shot notification when
 * the target condition is met:
 *   - TARGET_REACHED → currentPrice >= thresholdPrice
 *   - PRICE_DROP     → currentPrice <= thresholdPrice
 *
 * OUTBID alerts are handled inline at bid time (BidSideEffects), not here.
 * Fired alerts are deactivated so they never re-notify.
 *
 * Bounded per tick: scans up to MAX_ALERTS active alerts.
 */
const MAX_ALERTS = 1000;
const DEACTIVATE_BATCH = 450;

interface FireItem {
  id: string;
  userId: string;
  auctionId: string;
  auctionTitle: string;
  price: number;
  threshold: number;
  type: 'TARGET_REACHED' | 'PRICE_DROP';
}

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const snap = await db
      .collection('alerts')
      .where('isActive', '==', true)
      .limit(MAX_ALERTS)
      .get();

    if (snap.empty) return NextResponse.json({ success: true, processed: 0, fired: 0 });

    const alerts = snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as { type?: string; userId?: string; auctionId?: string; thresholdPrice?: number }),
      }))
      .filter(
        (a) =>
          (a.type === 'TARGET_REACHED' || a.type === 'PRICE_DROP') &&
          typeof a.auctionId === 'string' &&
          typeof a.thresholdPrice === 'number',
      );

    if (alerts.length === 0) return NextResponse.json({ success: true, processed: 0, fired: 0 });

    const auctionIds = [...new Set(alerts.map((a) => a.auctionId as string))];
    const auctionSnaps = await db.getAll(...auctionIds.map((id) => db.collection('auctions').doc(id)));
    const auctionMap = new Map<string, Record<string, unknown>>();
    auctionSnaps.forEach((s) => {
      if (s.exists) auctionMap.set(s.id, s.data()!);
    });

    const toFire: FireItem[] = [];
    for (const a of alerts) {
      const auction = auctionMap.get(a.auctionId as string);
      if (!auction || auction.status !== 'ACTIVE') continue;
      const price = auction.currentPrice as number;
      const threshold = a.thresholdPrice as number;
      const met = a.type === 'TARGET_REACHED' ? price >= threshold : price <= threshold;
      if (met) {
        toFire.push({
          id: a.id,
          userId: a.userId as string,
          auctionId: a.auctionId as string,
          auctionTitle: String(auction.title ?? 'an auction'),
          price,
          threshold,
          type: a.type as 'TARGET_REACHED' | 'PRICE_DROP',
        });
      }
    }

    const tasks: Promise<unknown>[] = toFire.map((a) =>
      rtdbPush(RTDB_PATHS.userNotifications(a.userId), {
        event: FIREBASE_EVENTS.PRICE_ALERT,
        auctionId: a.auctionId,
        auctionTitle: a.auctionTitle,
        type: a.type,
        amount: a.price,
        threshold: a.threshold,
        title: 'Price Alert',
        message: `"${a.auctionTitle}" reached ৳${a.price.toLocaleString()}.`,
        timestamp: Date.now(),
      }).catch((e) => log.error('[Cron:process-alerts] notify failed', e, { alertId: a.id })),
    );
    await Promise.allSettled(tasks);

    // Deactivate fired alerts (one-shot) in chunked batches.
    for (let i = 0; i < toFire.length; i += DEACTIVATE_BATCH) {
      const batch = db.batch();
      const now = new Date();
      toFire.slice(i, i + DEACTIVATE_BATCH).forEach((a) => {
        batch.update(db.collection('alerts').doc(a.id), { isActive: false, firedAt: now, updatedAt: now });
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, processed: alerts.length, fired: toFire.length });
  } catch (error) {
    log.error('[Cron:process-alerts] failed', error, { area: 'cron', severity: 'warning' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
