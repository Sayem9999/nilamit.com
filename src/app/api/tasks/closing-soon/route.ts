import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db, toDate } from '@/lib/db';
import { pushUserNotification } from '@/lib/firebase-admin';
import { FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendEndingSoonEmail } from '@/lib/firebase-email';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { Auction, User } from '@/types';

/**
 * Closing-soon alerts. Works in two modes:
 *
 *  • Per-auction (Cloud Tasks): body = { auctionId } — fires alerts for one
 *    auction ~1h before it ends.
 *  • Batch (GitHub Actions, every 15m): body = {} — scans for ACTIVE auctions
 *    ending within the next CLOSING_WINDOW_MS that haven't been alerted yet.
 *
 * Both paths set `closingSoonNotifiedAt` on the auction so an auction is never
 * alerted twice (even if both schedulers are wired).
 */
const CLOSING_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const BATCH_LIMIT = 100;

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

  const tasks: Promise<unknown>[] = [];

  if (!watchlistSnap.empty) {
    const watcherIds = [...new Set(watchlistSnap.docs.map((d) => d.data().userId as string))];
    const userSnaps = await db.getAll(...watcherIds.map((id) => db.collection('users').doc(id)));
    const usersMap = new Map(userSnaps.map((s) => [s.id, s.exists ? ({ id: s.id, ...s.data() } as User) : null]));

    for (const watcherId of watcherIds) {
      const user = usersMap.get(watcherId);
      if (!user) continue;
      notifiedUserIds.add(user.id);

      if (user.email) {
        tasks.push(
          sendEndingSoonEmail(user.email as string, auction.title as string, auction.currentPrice as number, auction.id)
            .catch((err) => log.error(`[Tasks:closing-soon] Email failed for user ${user.id}`, err)),
        );
        emails++;
      }

      tasks.push(
        pushUserNotification(user.id, {
          event: FIREBASE_EVENTS.ENDING_SOON,
          auctionId: auction.id,
          auctionTitle: auction.title as string,
          amount: auction.currentPrice as number,
          currentPrice: auction.currentPrice as number,
          endTime: toDate(auction.endTime).toISOString(),
          timestamp: Date.now(),
        }).catch((err) => log.error(`[Tasks:closing-soon] RTDB failed for user ${user.id}`, err)),
      );
      events++;
    }
  }

  if (!alertsSnap.empty) {
    for (const alertDoc of alertsSnap.docs) {
      const userId = alertDoc.data().userId as string;
      if (notifiedUserIds.has(userId)) continue;

      tasks.push(
        pushUserNotification(userId, {
          event: FIREBASE_EVENTS.ENDING_SOON,
          auctionId: auction.id,
          auctionTitle: auction.title as string,
          amount: auction.currentPrice as number,
          currentPrice: auction.currentPrice as number,
          endTime: toDate(auction.endTime).toISOString(),
          timestamp: Date.now(),
        }).catch((err) => log.error(`[Tasks:closing-soon] RTDB (alert) failed for user ${userId}`, err)),
      );
      events++;
    }
  }

  await Promise.allSettled(tasks);
  return { emails, events };
}

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  let auctionId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    auctionId = body?.auctionId;
  } catch {
    auctionId = undefined;
  }

  try {
    // ── Per-auction mode (Cloud Tasks) ──
    if (auctionId) {
      const doc = await db.collection('auctions').doc(auctionId).get();
      if (!doc.exists) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

      const auction = { id: doc.id, ...doc.data() } as Auction & { closingSoonNotifiedAt?: unknown };
      if (auction.status !== 'ACTIVE') return NextResponse.json({ success: true, message: 'Auction is no longer active' });
      if (auction.closingSoonNotifiedAt) return NextResponse.json({ success: true, message: 'Already notified' });

      const { emails, events } = await notifyForAuction(auction);
      await doc.ref.update({ closingSoonNotifiedAt: new Date() });
      return NextResponse.json({ success: true, mode: 'single', emailsQueued: emails, rtdbEvents: events });
    }

    // ── Batch mode (GitHub Actions) ──
    const now = new Date();
    const horizon = new Date(now.getTime() + CLOSING_WINDOW_MS);
    const snap = await db.collection('auctions')
      .where('status', '==', 'ACTIVE')
      .where('endTime', '>', now)
      .where('endTime', '<=', horizon)
      .orderBy('endTime', 'asc')
      .limit(BATCH_LIMIT)
      .get();

    let processed = 0;
    let emails = 0;
    let events = 0;
    for (const doc of snap.docs) {
      const auction = { id: doc.id, ...doc.data() } as Auction & { closingSoonNotifiedAt?: unknown };
      if (auction.closingSoonNotifiedAt) continue; // already alerted
      const res = await notifyForAuction(auction);
      await doc.ref.update({ closingSoonNotifiedAt: new Date() });
      processed++;
      emails += res.emails;
      events += res.events;
    }

    return NextResponse.json({ success: true, mode: 'batch', processed, emailsQueued: emails, rtdbEvents: events });
  } catch (error) {
    log.error('[Tasks:closing-soon] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
