/**
 * POST /api/cron/enforce-policies
 *
 * Penalises winners who didn't pay within 24h, triggers Second Chance Offers,
 * and expires auctions with no second bidder.
 *
 * Frequency: Hourly (Cloud Scheduler).
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { AuctionService } from '@/services/auction/auction-service';
import { calculateLevel } from '@/lib/gamification-engine';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const now    = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const auctionsSnap = await db.collection('auctions')
      .where('status', '==', 'AWAITING_PAYMENT')
      .where('updatedAt', '<', cutoff)
      .limit(20)
      .get();

    if (auctionsSnap.empty) {
      return { processed: 0, success: 0, failed: 0, penalized: 0 };
    }

    const tally = { processed: auctionsSnap.size, success: 0, failed: 0, penalized: 0 };

    for (const doc of auctionsSnap.docs) {
      const auctionId = doc.id;
      const nonPayingWinnerId = doc.data().currentBidderId as string | undefined;

      const offerRes = await AuctionService.createSecondChanceOffer(auctionId);

      if (offerRes.success) {
        tally.success++;

        if (nonPayingWinnerId) {
          try {
            await db.runTransaction(async (tx) => {
              const uRef  = db.collection('users').doc(nonPayingWinnerId);
              const uSnap = await tx.get(uRef);
              if (!uSnap.exists) return;

              const userData = uSnap.data()!;
              const currentXP = userData.xp || 0;
              const newXP = Math.max(0, currentXP - 100);
              const newLevel = calculateLevel(newXP);

              tx.update(uRef, {
                xp:             newXP,
                userLevel:      newLevel,
                winningStreak:  0,
                updatedAt:      now,
              });
            });
            tally.penalized++;
          } catch (e) {
            log.error('Bot: penalty failed', e, { userId: nonPayingWinnerId });
          }
        }
      } else {
        await db.collection('auctions').doc(auctionId).update({
          status: 'EXPIRED', updatedAt: now,
        });
        tally.failed++;
      }
    }

    return tally;
  }, { maxAttempts: 3, initialDelayMs: 1000 });

  if (result.error) {
    Sentry.captureException(result.error, {
      tags: { component: 'cron', job: 'enforce-policies', area: 'cron', severity: 'critical' },
    });
    return cronError(`enforce-policies failed after ${result.attempts} attempts: ${result.error.message}`);
  }

  return NextResponse.json({
    success: true,
    ...result.data,
    processedAt: new Date().toISOString(),
  });
}
