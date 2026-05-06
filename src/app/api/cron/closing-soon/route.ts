/**
 * POST /api/cron/closing-soon
 *
 * Notifies watchers and ENDING_SOON alert-holders for auctions ending within
 * 1 hour. Sends email (Firebase Trigger Email) + RTDB event.
 *
 * Scheduled every 15 minutes by Cloud Scheduler.
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

const PER_AUCTION_CONCURRENCY = 8;

async function notifyForAuction(auction: Auction): Promise<{ emails: number; events: number }> {
  let emails = 0;
  let events = 0;

  const notifiedUserIds = new Set<string>();

  const [watchlistSnap, alertsSnap] = await Promise.all([
    db.collection('watchlist').where('auctionId', '==', auction.id).get(),
    db.collection('alerts')
      .where('auctionId', '==', auction.id)
      .where('type', '==', 'ENDING_SOON')
      .where('isActive', '==', true)
      .get(),
  ]);

  if (!watchlistSnap.empty) {
    const watcherIds = watchlistSnap.docs.map(d => d.data().userId as string);
    const userSnaps  = await db.getAll(...watcherIds.map(id => db.collection('users').doc(id)));
    const usersMap   = new Map(userSnaps.map(s => [s.id, s.exists ? { id: s.id, ...s.data() } as User : null]));

    const tasks: Promise<unknown>[] = [];
    for (const watcherId of watcherIds) {
      const user = usersMap.get(watcherId);
      if (!user) continue;
      notifiedUserIds.add(user.id);

      if (user.email) {
        tasks.push(
          sendEndingSoonEmail(user.email as string, auction.title as string, auction.currentPrice as number, auction.id)
            .catch(err => log.error(`[Cron:closing-soon] Email failed for user ${user.id}`, err)),
        );
        emails++;
      }

      tasks.push(
        rtdbPush(RTDB_PATHS.userNotifications(user.id), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title as string,
          currentPrice: auction.currentPrice as number,
          endTime:      toDate(auction.endTime).toISOString(),
        }).catch(err => log.error(`[Cron:closing-soon] RTDB failed for user ${user.id}`, err)),
      );
      events++;
    }
    await Promise.allSettled(tasks);
  }

  if (!alertsSnap.empty) {
    const tasks: Promise<unknown>[] = [];
    for (const alertDoc of alertsSnap.docs) {
      const alert = alertDoc.data();
      const userId = alert.userId as string;
      if (notifiedUserIds.has(userId)) continue;

      tasks.push(
        rtdbPush(RTDB_PATHS.userNotifications(userId), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title as string,
          currentPrice: auction.currentPrice as number,
          endTime:      toDate(auction.endTime).toISOString(),
        }).catch(err => log.error(`[Cron:closing-soon] RTDB (alert) failed for user ${userId}`, err)),
      );
      events++;
    }
    await Promise.allSettled(tasks);
  }

  return { emails, events };
}

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

    for (let i = 0; i < auctions.length; i += PER_AUCTION_CONCURRENCY) {
      const chunk = auctions.slice(i, i + PER_AUCTION_CONCURRENCY);
      const results = await Promise.all(chunk.map(notifyForAuction));
      for (const r of results) {
        emailsQueued += r.emails;
        rtdbEvents   += r.events;
      }
    }

    return { auctionsProcessed: auctions.length, emailsQueued, rtdbEvents };
  }, { maxAttempts: 3, initialDelayMs: 2000 });

  if (result.error) {
    return cronError(`closing-soon failed: ${result.error.message}`);
  }

  return NextResponse.json({ success: true, ...result.data, processedAt: new Date().toISOString() });
}
