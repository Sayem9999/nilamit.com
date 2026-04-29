/**
 * POST /api/cron/process-alerts
 *
 * Checks all active TARGET_REACHED and PRICE_DROP alerts.
 * Triggers a real-time RTDB notification and deactivates the alert.
 *
 * Called every 2 minutes by Google Cloud Scheduler.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { Alert, Auction } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const alertsSnap = await db.collection('alerts')
      .where('isActive', '==', true)
      .where('type', 'in', ['TARGET_REACHED', 'PRICE_DROP'])
      .get();

    const activeAlerts = alertsSnap.docs
      .map(d => ({ ...d.data(), id: d.id } as Alert))
      .filter(a => !!a.auctionId && a.thresholdPrice !== null);

    if (activeAlerts.length === 0) return { checked: 0, triggered: 0 };

    // Batch-fetch all referenced auctions in one round-trip instead of per-alert
    const auctionIds = [...new Set(activeAlerts.map(a => a.auctionId as string))];
    const auctionSnaps = await db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id)));
    const auctionMap = new Map(
      auctionSnaps
        .filter(s => s.exists)
        .map(s => [s.id, s.data() as Auction]),
    );

    let triggered = 0;
    const alertsToDeactivate: string[] = [];

    for (const alert of activeAlerts) {
      const auction = auctionMap.get(alert.auctionId as string);
      if (!auction) continue;

      const currentPrice = auction.currentPrice as number;
      const threshold    = alert.thresholdPrice as number;

      const isTargetReached = alert.type === 'TARGET_REACHED' && currentPrice >= threshold;
      const isPriceDropped  = alert.type === 'PRICE_DROP'     && currentPrice <= threshold;

      if (!isTargetReached && !isPriceDropped) continue;

      rtdbPush(RTDB_PATHS.userNotifications(alert.userId as string), {
        event:        FIREBASE_EVENTS.PRICE_ALERT,
        auctionId:    alert.auctionId,
        auctionTitle: auction.title as string,
        amount:       currentPrice,
        type:         alert.type as string,
        threshold,
      }).catch(err => log.error(`[Cron:process-alerts] RTDB push failed for alert ${alert.id}`, err));

      alertsToDeactivate.push(alert.id as string);
      triggered++;
    }

    if (alertsToDeactivate.length > 0) {
      const batch = db.batch();
      for (const id of alertsToDeactivate) {
        batch.update(db.collection('alerts').doc(id), { isActive: false, updatedAt: new Date() });
      }
      await batch.commit();
    }

    return { checked: activeAlerts.length, triggered };
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
