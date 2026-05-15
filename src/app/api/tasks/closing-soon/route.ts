import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db, toDate } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendEndingSoonEmail } from '@/lib/firebase-email';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { Auction, User } from '@/types';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const { auctionId } = await req.json();
    if (!auctionId) {
      return NextResponse.json({ error: 'Missing auctionId' }, { status: 400 });
    }

    const doc = await db.collection('auctions').doc(auctionId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const auction = { id: doc.id, ...doc.data() } as Auction;
    if (auction.status !== 'ACTIVE') {
      return NextResponse.json({ success: true, message: 'Auction is no longer active' });
    }

    let emails = 0;
    let events = 0;
    const notifiedUserIds = new Set<string>();

    const [watchlistSnap, alertsSnap] = await Promise.all([
      db.collection('watchlist').where('auctionId', '==', auctionId).get(),
      db.collection('alerts')
        .where('auctionId', '==', auctionId)
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
              .catch(err => log.error(`[Tasks:closing-soon] Email failed for user ${user.id}`, err)),
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
          }).catch(err => log.error(`[Tasks:closing-soon] RTDB failed for user ${user.id}`, err)),
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
          }).catch(err => log.error(`[Tasks:closing-soon] RTDB (alert) failed for user ${userId}`, err)),
        );
        events++;
      }
      await Promise.allSettled(tasks);
    }

    return NextResponse.json({ success: true, emailsQueued: emails, rtdbEvents: events });
  } catch (error) {
    log.error('[Tasks:closing-soon] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
