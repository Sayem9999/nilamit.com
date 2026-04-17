/**
 * GET /api/cron/process-alerts
 *
 * Checks all active PRICE_DROP and TARGET_REACHED alerts.
 * Triggers Pusher notification + deactivates alert (one-time trigger).
 *
 * Called every 2 minutes by Vercel Cron.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const snap = await db.collection('alerts')
      .where('isActive', '==', true)
      .where('type',     'in', ['TARGET_REACHED', 'PRICE_DROP'])
      .get();

    const candidates = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as { id: string; userId: string; auctionId?: string | null; type: string; thresholdPrice?: number | null }))
      .filter(a => a.auctionId);

    const auctionIds = [...new Set(candidates.map(a => a.auctionId!))];
    const aucSnaps   = await Promise.all(auctionIds.map(id => db.collection('auctions').doc(id).get()));
    const aucMap     = new Map(aucSnaps.filter(s => s.exists).map(s => {
      const a = s.data()!;
      return [s.id, { currentPrice: a.currentPrice as number, title: a.title as string }];
    }));

    let triggered = 0;
    const alertsToDeactivate: string[] = [];

    for (const alert of candidates) {
      const auc = aucMap.get(alert.auctionId!);
      if (!auc || alert.thresholdPrice == null) continue;

      const { currentPrice } = auc;
      const threshold        = alert.thresholdPrice;

      const isTargetReached = alert.type === 'TARGET_REACHED' && currentPrice >= threshold;
      const isPriceDropped  = alert.type === 'PRICE_DROP'     && currentPrice <= threshold;
      if (!isTargetReached && !isPriceDropped) continue;

      await rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
        event:        FIREBASE_EVENTS.PRICE_ALERT,
        auctionId:    alert.auctionId,
        auctionTitle: auc.title,
        amount:       currentPrice,
        type:         alert.type,
        threshold,
      }).catch(err =>
        console.error(`[Cron:process-alerts] RTDB push failed for alert ${alert.id}:`, err)
      );

      alertsToDeactivate.push(alert.id);
      triggered++;
    }

    if (alertsToDeactivate.length > 0) {
      const batch = db.batch();
      const now   = new Date();
      for (const id of alertsToDeactivate) {
        batch.update(db.collection('alerts').doc(id), { isActive: false, updatedAt: now });
      }
      await batch.commit();
    }

    return { checked: candidates.length, triggered };
  }, { maxAttempts: 3 });

  if (result.error) {
    return cronError(`process-alerts failed: ${result.error.message}`);
  }

  return NextResponse.json({
    success: true,
    ...result.data,
    processedAt: new Date().toISOString(),
  });
}
