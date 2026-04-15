/**
 * GET /api/cron/process-alerts
 *
 * Checks all active PRICE_DROP and TARGET_REACHED alerts.
 * Triggers Pusher notification + deactivates alert (one-time trigger).
 *
 * Called every 2 minutes by Vercel Cron.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const activeAlerts = await prisma.alert.findMany({
      where: {
        isActive:  true,
        type:      { in: ['TARGET_REACHED', 'PRICE_DROP'] },
        auctionId: { not: null },
      },
      include: {
        auction: { select: { currentPrice: true, title: true } },
        user:    { select: { id: true } },
      },
    });

    let triggered = 0;
    const alertsToDeactivate: string[] = [];

    for (const alert of activeAlerts) {
      if (!alert.auction || alert.thresholdPrice === null) continue;

      const { currentPrice } = alert.auction;
      const threshold        = alert.thresholdPrice;

      const isTargetReached = alert.type === 'TARGET_REACHED' && currentPrice >= threshold;
      const isPriceDropped  = alert.type === 'PRICE_DROP'     && currentPrice <= threshold;

      if (!isTargetReached && !isPriceDropped) continue;

      // Push real-time notification to user's RTDB inbox (non-fatal)
      await rtdbPush(RTDB_PATHS.userNotifications(alert.user.id), {
        event:        FIREBASE_EVENTS.PRICE_ALERT,
        auctionId:    alert.auctionId,
        auctionTitle: alert.auction.title,
        amount:       currentPrice,
        type:         alert.type,
        threshold,
      }).catch(err =>
        console.error(`[Cron:process-alerts] RTDB push failed for alert ${alert.id}:`, err)
      );

      alertsToDeactivate.push(alert.id);
      triggered++;
    }

    // Deactivate triggered alerts in a single batch update
    if (alertsToDeactivate.length > 0) {
      await prisma.alert.updateMany({
        where: { id: { in: alertsToDeactivate } },
        data:  { isActive: false },
      });
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
