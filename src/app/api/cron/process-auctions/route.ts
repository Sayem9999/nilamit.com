/**
 * GET /api/cron/process-auctions
 *
 * Finds ACTIVE auctions whose endTime has passed and transitions them:
 *   - No bids  → EXPIRED
 *   - Has bids → SOLD + creates EscrowTransaction + notifies winner via RTDB
 *
 * Called every minute by Vercel Cron.
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';
import { Auction, Bid } from '@/types';

export const dynamic = 'force-dynamic';

interface CronFailure {
  auctionId: string;
  attempts: number;
  error: string;
}

interface ProcessResult {
  totalExpired: number;
  sold: number;
  expired: number;
  failed: number;
  failedIds: string[];
  failures: CronFailure[];
}

/**
 * Persist a cron failure so it survives the request lifecycle. Vercel logs
 * roll over and Sentry events can be sampled / dropped — Firestore is the
 * authoritative record an operator can query later to retry by hand.
 */
async function recordCronFailure(failure: CronFailure & { job: string }) {
  try {
    await db.collection('cronFailures').add({
      ...failure,
      createdAt: new Date(),
    });
  } catch (err) {
    // If we can't even write the failure record, we still need the operator
    // to find out — surface to Sentry directly.
    Sentry.captureException(err, {
      tags: { component: 'cron', job: failure.job, secondary: 'failure-write' },
      extra: failure as unknown as Record<string, unknown>,
    });
  }
}

async function processExpiredAuctions(): Promise<ProcessResult> {
  const now = new Date();

  const expiredSnap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .where('endTime', '<=', now)
    .get();

  const expiredAuctions = expiredSnap.docs.map(d => ({ ...d.data(), id: d.id } as Auction));

  const result: ProcessResult = {
    totalExpired: expiredAuctions.length,
    sold: 0,
    expired: 0,
    failed: 0,
    failedIds: [],
    failures: [],
  };

  for (const auction of expiredAuctions) {
    const attemptResult = await withRetry(async () => {
      const bidsSnap = await db.collection('bids')
        .where('auctionId', '==', auction.id)
        .orderBy('amount', 'desc')
        .limit(1)
        .get();
        
      const highestBid = bidsSnap.empty ? null : ({ ...bidsSnap.docs[0].data(), id: bidsSnap.docs[0].id } as Bid);

      // Firestore doesn't have multi-collection distributed transactions easily without batch
      const batch = db.batch();
      const auctionRef = db.collection('auctions').doc(auction.id);

      if (!highestBid) {
        // No bids — expire gracefully
        batch.update(auctionRef, { status: 'EXPIRED', updatedAt: new Date() });
      } else {
        // Has a winner — mark SOLD + create escrow
        batch.update(auctionRef, { status: 'SOLD', winnerId: highestBid.bidderId, updatedAt: new Date() });

        const escrowRef = db.collection('escrowTransactions').doc(auction.id);
        // Using set with merge for upsert-like behavior
        batch.set(escrowRef, {
          auctionId: auction.id,
          buyerId:   highestBid.bidderId,
          amount:    highestBid.amount,
          status:    'HELD',
          updatedAt: new Date(),
        }, { merge: true });
      }

      await batch.commit();

      // Notify winner via Firebase RTDB
      if (highestBid) {
        await rtdbPush(RTDB_PATHS.userNotifications(highestBid.bidderId as string), {
          event:     FIREBASE_EVENTS.AUCTION_WON,
          auctionId: auction.id,
          title:     auction.title as string,
          amount:    highestBid.amount,
        }).catch(err => console.error(`[Cron] RTDB notify failed for auction ${auction.id}:`, err));
      }

      return !!highestBid; // true = SOLD, false = EXPIRED
    }, { maxAttempts: 3 });

    if (attemptResult.error) {
      console.error(`[Cron:process-auctions] Auction ${auction.id} failed after ${attemptResult.attempts} attempts:`, attemptResult.error);
      result.failed++;
      result.failedIds.push(auction.id);
      result.failures.push({
        auctionId: auction.id,
        attempts:  attemptResult.attempts,
        error:     attemptResult.error.message,
      });
    } else if (attemptResult.data === true) {
      result.sold++;
    } else {
      result.expired++;
    }
  }

  return result;
}

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const outerResult = await withRetry(processExpiredAuctions, { maxAttempts: 2 });

  if (outerResult.error) {
    return cronError(`process-auctions failed: ${outerResult.error.message}`);
  }

  const r = outerResult.data!;

  if (r.failed > 0) {
    console.error(`[Cron:process-auctions] ${r.failed} auctions failed to process:`, r.failedIds);
    Sentry.captureMessage(
      `[Cron:process-auctions] ${r.failed}/${r.totalExpired} auctions failed`,
      { level: 'error', tags: { component: 'cron', job: 'process-auctions' }, extra: { failedIds: r.failedIds } },
    );
    // Persist each failure so an operator can find and re-drive them later.
    await Promise.all(r.failures.map((f) => recordCronFailure({ ...f, job: 'process-auctions' })));
  }

  return NextResponse.json({
    success: r.failed === 0,
    totalExpired: r.totalExpired,
    sold:         r.sold,
    expired:      r.expired,
    failed:       r.failed,
    ...(r.failed > 0 ? { failedAuctionIds: r.failedIds } : {}),
    processedAt: new Date().toISOString(),
  });
}
