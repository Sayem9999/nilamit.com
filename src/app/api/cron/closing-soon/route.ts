/**
 * GET /api/cron/closing-soon
 *
 * Notifies watchers and alert-holders about auctions ending within 1 hour.
 * Sends email (Firebase Trigger Email extension) + real-time RTDB event.
 *
 * Called every 15 minutes by Google Cloud Scheduler.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AuctionStatus } from '@prisma/client';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendEndingSoonEmail } from '@/lib/firebase-email';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const now            = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const auctions = await prisma.auction.findMany({
      where: {
        status:  AuctionStatus.ACTIVE,
        endTime: { gt: now, lte: oneHourFromNow },
      },
      include: {
        watchlist: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        alerts: {
          where: { type: 'ENDING_SOON', isActive: true },
          select: { userId: true },
        },
      },
    });

    let emailsQueued = 0;
    let rtdbEvents   = 0;

    for (const auction of auctions) {
      const notifiedUserIds = new Set<string>();

      // 1. Notify watchlist users
      for (const entry of auction.watchlist) {
        const { user } = entry;
        notifiedUserIds.add(user.id);

        // Queue email via Firebase Trigger Email extension (non-fatal)
        if (user.email) {
          sendEndingSoonEmail(user.email, auction.title, auction.currentPrice, auction.id)
            .catch(err => console.error(`[Cron:closing-soon] Email failed for user ${user.id}:`, err));
          emailsQueued++;
        }

        // Real-time RTDB notification
        await rtdbPush(RTDB_PATHS.userNotifications(user.id), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title,
          currentPrice: auction.currentPrice,
          endTime:      auction.endTime.toISOString(),
        }).catch(err => console.error(`[Cron:closing-soon] RTDB failed for user ${user.id}:`, err));
        rtdbEvents++;
      }

      // 2. Notify explicit ENDING_SOON alert holders not already in watchlist
      for (const alert of auction.alerts) {
        if (notifiedUserIds.has(alert.userId)) continue;

        await rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title,
          currentPrice: auction.currentPrice,
          endTime:      auction.endTime.toISOString(),
        }).catch(err => console.error(`[Cron:closing-soon] RTDB (alert) failed for user ${alert.userId}:`, err));
        rtdbEvents++;
      }
    }

    return { auctionsProcessed: auctions.length, emailsQueued, rtdbEvents };
  }, { maxAttempts: 3, initialDelayMs: 2000 });

  if (result.error) {
    return cronError(`closing-soon failed: ${result.error.message}`);
  }

  return NextResponse.json({ success: true, ...result.data, processedAt: new Date().toISOString() });
}
