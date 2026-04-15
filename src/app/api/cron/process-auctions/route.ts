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
import { prisma } from '@/lib/db';
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

  const expiredAuctions = await prisma.auction.findMany({
    where: { status: 'ACTIVE', endTime: { lte: now } },
    include: {
      bids: { orderBy: { amount: 'desc' }, take: 1 },
    },
  });

  const result: ProcessResult = {
    totalExpired: expiredAuctions.length,
    sold: 0,
    expired: 0,
    failed: 0,
    failedIds: [],
  };

  for (const auction of expiredAuctions) {
    const attemptResult = await withRetry(async () => {
      const highestBid = auction.bids[0];

      await prisma.$transaction(async (tx) => {
        if (!highestBid) {
          // No bids — expire gracefully
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          // Has a winner — mark SOLD + create escrow
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: 'SOLD', winnerId: highestBid.bidderId },
          });

          // Only create escrow if one doesn't already exist (idempotent)
          await tx.escrowTransaction.upsert({
            where: { auctionId: auction.id },
            create: {
              auctionId: auction.id,
              buyerId:   highestBid.bidderId,
              amount:    highestBid.amount,
              status:    'HELD',
            },
            update: {}, // Already exists — no-op
          });
        }
      });

      // Notify winner via Firebase RTDB (outside transaction so RTDB failure doesn't roll back)
      if (highestBid) {
        await rtdbPush(RTDB_PATHS.userNotifications(highestBid.bidderId), {
          event:     FIREBASE_EVENTS.AUCTION_WON,
          auctionId: auction.id,
          title:     auction.title,
          amount:    highestBid.amount,
        }).catch(err => console.error(`[Cron] RTDB notify failed for auction ${auction.id}:`, err));
      }

      return !!highestBid; // true = SOLD, false = EXPIRED
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
