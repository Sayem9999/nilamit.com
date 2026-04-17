/**
 * GET /api/cron/process-auctions
 *
 * Finds ACTIVE auctions whose endTime has passed and transitions them:
 *   - No bids  → EXPIRED
 *   - Has bids → SOLD + creates EscrowTransaction + notifies winner via Pusher
 *
 * Called every minute by Vercel Cron.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';

export const dynamic = 'force-dynamic';

interface ProcessResult {
  totalExpired: number;
  sold: number;
  expired: number;
  failed: number;
  failedIds: string[];
}

async function processExpiredAuctions(): Promise<ProcessResult> {
  const now = new Date();

  const expiredSnap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .where('endTime', '<=', now)
    .get();

  const expiredAuctions = await Promise.all(expiredSnap.docs.map(async d => {
    const a       = d.data();
    const bidSnap = await db.collection('bids')
      .where('auctionId', '==', d.id)
      .orderBy('amount', 'desc')
      .limit(1)
      .get();
    const bidDoc  = bidSnap.docs[0];
    const highestBid = bidDoc ? { id: bidDoc.id, ...bidDoc.data() } as { id: string; bidderId: string; amount: number } : null;
    return { id: d.id, title: a.title as string, highestBid };
  }));

  const result: ProcessResult = {
    totalExpired: expiredAuctions.length,
    sold: 0,
    expired: 0,
    failed: 0,
    failedIds: [],
  };

  for (const auction of expiredAuctions) {
    const attemptResult = await withRetry(async () => {
      const highestBid = auction.highestBid;

      await db.runTransaction(async (tx) => {
        const auctionRef = db.collection('auctions').doc(auction.id);
        if (!highestBid) {
          tx.update(auctionRef, { status: 'EXPIRED', updatedAt: new Date() });
        } else {
          tx.update(auctionRef, { status: 'SOLD', winnerId: highestBid.bidderId, updatedAt: new Date() });

          // Idempotent: doc id = auctionId, only create if missing
          const escrowRef  = db.collection('escrowTransactions').doc(auction.id);
          const escrowSnap = await tx.get(escrowRef);
          if (!escrowSnap.exists) {
            tx.set(escrowRef, {
              id:        auction.id,
              auctionId: auction.id,
              buyerId:   highestBid.bidderId,
              amount:    highestBid.amount,
              status:    'HELD',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      });

      if (highestBid) {
        await rtdbPush(RTDB_PATHS.userNotifications(highestBid.bidderId), {
          event:     FIREBASE_EVENTS.AUCTION_WON,
          auctionId: auction.id,
          title:     auction.title,
          amount:    highestBid.amount,
        }).catch(err => console.error(`[Cron] RTDB notify failed for auction ${auction.id}:`, err));
      }

      return !!highestBid;
    }, { maxAttempts: 3 });

    if (attemptResult.error) {
      console.error(`[Cron:process-auctions] Auction ${auction.id} failed after ${attemptResult.attempts} attempts:`, attemptResult.error);
      result.failed++;
      result.failedIds.push(auction.id);
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
