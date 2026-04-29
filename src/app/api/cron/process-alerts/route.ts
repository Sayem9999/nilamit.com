/**
 * GET /api/cron/process-alerts
 *
 * Checks all active PRICE_DROP and TARGET_REACHED alerts.
 * Triggers Realtime notification (RTDB) + deactivates alert (one-time trigger).
 *
 * Called every 2 minutes by Vercel Cron.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';
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
      .filter(a => !!a.auctionId);

    let triggered = 0;
    const alertsToDeactivate: string[] = [];

    for (const alert of activeAlerts) {
      if (alert.thresholdPrice === null) continue;

      const auctionSnap = await db.collection('auctions').doc(alert.auctionId as string).get();
      if (!auctionSnap.exists) continue;
      const auction = auctionSnap.data() as Auction;

      const currentPrice = auction.currentPrice as number;
      const threshold    = alert.thresholdPrice as number;

      const isTargetReached = alert.type === 'TARGET_REACHED' && currentPrice >= threshold;
      const isPriceDropped  = alert.type === 'PRICE_DROP'     && currentPrice <= threshold;

      if (!isTargetReached && !isPriceDropped) continue;

      // Push real-time notification to user's RTDB inbox (non-fatal)
      await rtdbPush(RTDB_PATHS.userNotifications(alert.userId as string), {
        event:        FIREBASE_EVENTS.PRICE_ALERT,
        auctionId:    alert.auctionId,
        auctionTitle: auction.title as string,
        amount:       currentPrice,
        type:         alert.type as string,
        threshold,
      }).catch(err =>
        console.error(`[Cron:process-alerts] RTDB push failed for alert ${alert.id}:`, err)
      );

      alertsToDeactivate.push(alert.id as string);
      triggered++;
    }

    // Deactivate triggered alerts in a single batch update
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
