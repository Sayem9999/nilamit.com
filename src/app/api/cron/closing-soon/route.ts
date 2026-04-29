/**
 * POST /api/cron/closing-soon
 *
 * Notifies watchers and alert-holders about auctions ending within 1 hour.
 * Sends email (Firebase Trigger Email extension) + real-time RTDB event.
 *
 * Called every 15 minutes by Google Cloud Scheduler.
 */

import { NextResponse } from 'next/server';
import { db, toDate } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendEndingSoonEmail } from '@/lib/firebase-email';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { Auction, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const now            = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const auctionsSnap = await db.collection('auctions')
      .where('status', '==', 'ACTIVE')
      .where('endTime', '>', now)
      .where('endTime', '<=', oneHourFromNow)
      .get();

    const auctions = auctionsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Auction));

    let emailsQueued = 0;
    let rtdbEvents   = 0;

    for (const auction of auctions) {
      const notifiedUserIds = new Set<string>();

      // Batch-fetch all watchlist users for this auction in one round-trip
      const watchlistSnap = await db.collection('watchlist').where('auctionId', '==', auction.id).get();
      if (!watchlistSnap.empty) {
        const watcherIds = watchlistSnap.docs.map(d => d.data().userId as string);
        const userSnaps  = await db.getAll(...watcherIds.map(id => db.collection('users').doc(id)));
        const usersMap   = new Map(userSnaps.map(s => [s.id, s.exists ? { id: s.id, ...s.data() } as User : null]));

        for (const watcherId of watcherIds) {
          const user = usersMap.get(watcherId);
          if (!user) continue;
          notifiedUserIds.add(user.id);

          if (user.email) {
            sendEndingSoonEmail(user.email as string, auction.title as string, auction.currentPrice as number, auction.id)
              .catch(err => log.error(`[Cron:closing-soon] Email failed for user ${user.id}`, err));
            emailsQueued++;
          }

          rtdbPush(RTDB_PATHS.userNotifications(user.id), {
            event:        FIREBASE_EVENTS.ENDING_SOON,
            auctionId:    auction.id,
            auctionTitle: auction.title as string,
            currentPrice: auction.currentPrice as number,
            endTime:      toDate(auction.endTime).toISOString(),
          }).catch(err => log.error(`[Cron:closing-soon] RTDB failed for user ${user.id}`, err));
          rtdbEvents++;
        }
      }

      // ENDING_SOON alerts for users not already notified via watchlist
      const alertsSnap = await db.collection('alerts')
        .where('auctionId', '==', auction.id)
        .where('type', '==', 'ENDING_SOON')
        .where('isActive', '==', true)
        .get();

      for (const alertDoc of alertsSnap.docs) {
        const alert = alertDoc.data();
        if (notifiedUserIds.has(alert.userId)) continue;

        rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title as string,
          currentPrice: auction.currentPrice as number,
          endTime:      toDate(auction.endTime).toISOString(),
        }).catch(err => log.error(`[Cron:closing-soon] RTDB (alert) failed for user ${alert.userId}`, err));
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
