import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { calculateLevel } from '@/lib/gamification-engine';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';

/**
 * 24h payment-policy enforcement. A sale that the winner never pays for would
 * otherwise sit SOLD with a PENDING escrow forever. This job resolves those:
 * it expires the unpaid sale, cancels the (never-funded) escrow, and penalises
 * the non-paying winner.
 *
 * Modes:
 *  • Per-auction (Cloud Tasks): body = { auctionId }.
 *  • Batch (GitHub Actions, hourly): body = {} — scans PENDING escrows older
 *    than the deadline.
 *
 * NOTE: keyed off escrow status (not the never-written AWAITING_PAYMENT status).
 */
const PAYMENT_DEADLINE_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;

function tsToMs(v: unknown): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && v !== null && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

interface EnforceResult {
  acted: boolean;
  sellerId?: string;
  winnerId?: string | null;
  title?: string;
}

async function enforceOne(auctionId: string, now: number): Promise<EnforceResult> {
  return db.runTransaction<EnforceResult>(async (tx) => {
    const aRef = db.collection('auctions').doc(auctionId);
    const eRef = db.collection('escrowTransactions').doc(auctionId);

    // All reads must precede writes in a Firestore transaction.
    const [aSnap, eSnap] = await Promise.all([tx.get(aRef), tx.get(eRef)]);
    if (!aSnap.exists || !eSnap.exists) return { acted: false };

    const auction = aSnap.data()!;
    const escrow = eSnap.data()!;

    if (auction.status !== 'SOLD') return { acted: false };
    if (escrow.status !== 'PENDING') return { acted: false };
    if (now - tsToMs(escrow.createdAt) < PAYMENT_DEADLINE_MS) return { acted: false };

    const winnerId = (escrow.buyerId as string) ?? (auction.currentBidderId as string) ?? null;
    const winnerSnap = winnerId ? await tx.get(db.collection('users').doc(winnerId)) : null;

    const when = new Date();
    tx.update(aRef, { status: 'EXPIRED', updatedAt: when });
    tx.update(eRef, { status: 'CANCELLED', updatedAt: when });

    if (winnerSnap?.exists) {
      const xp = Math.max(0, (winnerSnap.data()!.xp || 0) - 100);
      tx.update(winnerSnap.ref, { xp, userLevel: calculateLevel(xp), winningStreak: 0, updatedAt: when });
    }

    return { acted: true, sellerId: auction.sellerId as string, winnerId, title: auction.title as string };
  });
}

async function notify(result: EnforceResult): Promise<void> {
  if (!result.acted) return;
  const title = result.title ?? 'your auction';
  const tasks: Promise<unknown>[] = [];
  if (result.sellerId) {
    tasks.push(
      rtdbPush(RTDB_PATHS.userNotifications(result.sellerId), {
        event: FIREBASE_EVENTS.AUCTION_CLOSED,
        message: `The winner of "${title}" did not pay within 24h. The sale was cancelled.`,
        timestamp: Date.now(),
      }).catch(() => {}),
    );
  }
  if (result.winnerId) {
    tasks.push(
      rtdbPush(RTDB_PATHS.userNotifications(result.winnerId), {
        event: FIREBASE_EVENTS.TRUST_UPDATE,
        message: `You missed the 24h payment window for "${title}". The sale was cancelled and a penalty was applied.`,
        timestamp: Date.now(),
      }).catch(() => {}),
    );
  }
  await Promise.allSettled(tasks);
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
    const now = Date.now();

    // ── Per-auction mode (Cloud Tasks) ──
    if (auctionId) {
      const result = await enforceOne(auctionId, now);
      await notify(result);
      return NextResponse.json({ success: true, mode: 'single', acted: result.acted });
    }

    // ── Batch mode (GitHub Actions, hourly) ──
    const deadline = new Date(now - PAYMENT_DEADLINE_MS);
    // orderBy('createdAt','desc') so this reuses the existing
    // escrowTransactions(status, createdAt DESC) composite index — a bare
    // range filter would implicitly need a (status, createdAt ASC) index.
    const snap = await db
      .collection('escrowTransactions')
      .where('status', '==', 'PENDING')
      .where('createdAt', '<=', deadline)
      .orderBy('createdAt', 'desc')
      .limit(BATCH_LIMIT)
      .get();

    let acted = 0;
    for (const doc of snap.docs) {
      // escrow doc id === auctionId (see processAuctionSale).
      const result = await enforceOne(doc.id, now);
      if (result.acted) {
        acted++;
        await notify(result);
      }
    }

    return NextResponse.json({ success: true, mode: 'batch', scanned: snap.size, acted });
  } catch (error) {
    log.error('[Tasks:enforce-policies] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
