/**
 * GET /api/cron/closing-soon
 *
 * Notifies watchers and alert-holders about auctions ending within 1 hour.
 * Sends email (Firebase Trigger Email extension) + real-time RTDB event.
 *
 * Called every 15 minutes by Google Cloud Scheduler.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuctionStatus } from '@/types';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendEndingSoonEmail } from '@/lib/firebase-email';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(v as string);
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const now            = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const aucSnap = await db.collection('auctions')
      .where('status',  '==', AuctionStatus.ACTIVE)
      .where('endTime', '>',  now)
      .where('endTime', '<=', oneHourFromNow)
      .get();

    let emailsQueued = 0;
    let rtdbEvents   = 0;
    let auctionsProcessed = 0;

    for (const aucDoc of aucSnap.docs) {
      auctionsProcessed++;
      const auction = {
        id:           aucDoc.id,
        title:        aucDoc.data().title as string,
        currentPrice: aucDoc.data().currentPrice as number,
        endTime:      toDate(aucDoc.data().endTime),
      };

      const [watchSnap, alertSnap] = await Promise.all([
        db.collection('watchlist').where('auctionId', '==', auction.id).get(),
        db.collection('alerts')
          .where('auctionId', '==', auction.id)
          .where('type',      '==', 'ENDING_SOON')
          .where('isActive',  '==', true)
          .get(),
      ]);

      const watcherIds = watchSnap.docs.map(d => d.data().userId as string);
      const userSnaps  = await Promise.all(watcherIds.map(uid => db.collection('users').doc(uid).get()));
      const watchers   = userSnaps.filter(s => s.exists).map(s => ({
        id:    s.id,
        email: s.data()?.email as string | null,
        name:  s.data()?.name  as string | null,
      }));

      const notifiedUserIds = new Set<string>();

      for (const user of watchers) {
        notifiedUserIds.add(user.id);

        if (user.email) {
          sendEndingSoonEmail(user.email, auction.title, auction.currentPrice, auction.id)
            .catch(err => console.error(`[Cron:closing-soon] Email failed for user ${user.id}:`, err));
          emailsQueued++;
        }

        await rtdbPush(RTDB_PATHS.userNotifications(user.id), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title,
          currentPrice: auction.currentPrice,
          endTime:      auction.endTime.toISOString(),
        }).catch(err => console.error(`[Cron:closing-soon] RTDB failed for user ${user.id}:`, err));
        rtdbEvents++;
      }

      for (const a of alertSnap.docs) {
        const userId = a.data().userId as string;
        if (notifiedUserIds.has(userId)) continue;

        await rtdbPush(RTDB_PATHS.userNotifications(userId), {
          event:        FIREBASE_EVENTS.ENDING_SOON,
          auctionId:    auction.id,
          auctionTitle: auction.title,
          currentPrice: auction.currentPrice,
          endTime:      auction.endTime.toISOString(),
        }).catch(err => console.error(`[Cron:closing-soon] RTDB (alert) failed for user ${userId}:`, err));
        rtdbEvents++;
      }
    }

    return { auctionsProcessed, emailsQueued, rtdbEvents };
  }, { maxAttempts: 3, initialDelayMs: 2000 });

  if (result.error) {
    return cronError(`closing-soon failed: ${result.error.message}`);
  }

  return NextResponse.json({ success: true, ...result.data, processedAt: new Date().toISOString() });
}
