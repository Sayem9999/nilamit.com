import { NextResponse } from 'next/server';
import * as Sentry from "@sentry/nextjs";
import { db } from '@/lib/db';
import { AuctionService } from '@/services/auction/auction-service';
import { calculateLevel } from '@/lib/gamification-engine';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Nilamit Policy Enforcement Bot
 * Frequency: Hourly (triggered by Vercel/Firebase Cron)
 */
export async function GET(request: Request) {
  // 1. Auth check (Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  try {
    // 2. Find auctions awaiting payment for too long
    const auctionsSnap = await db.collection('auctions')
      .where('status', '==', 'AWAITING_PAYMENT')
      .where('updatedAt', '<', cutoff)
      .limit(20)
      .get();

    if (auctionsSnap.empty) {
      return NextResponse.json({ processed: 0 });
    }

    const results = {
      processed: auctionsSnap.size,
      success: 0,
      failed: 0,
      penalized: 0,
    };

    for (const doc of auctionsSnap.docs) {
      const auctionId = doc.id;
      const auctionData = doc.data();
      const nonPayingWinnerId = auctionData.currentBidderId;

      // 3. Trigger Second Chance Offer
      const offerRes = await AuctionService.createSecondChanceOffer(auctionId);
      
      if (offerRes.success) {
        results.success++;
        
        // 4. Penalize the non-paying winner
        if (nonPayingWinnerId) {
          try {
            await db.runTransaction(async (tx) => {
              const uRef = db.collection('users').doc(nonPayingWinnerId);
              const uSnap = await tx.get(uRef);
              if (!uSnap.exists) return;

              const userData = uSnap.data()!;
              const currentXP = userData.xp || 0;
              // Penalty: -100 XP (Equal to a full win reward)
              const newXP = Math.max(0, currentXP - 100);
              const newLevel = calculateLevel(newXP);

              tx.update(uRef, {
                xp: newXP,
                userLevel: newLevel,
                winningStreak: 0, // Reset streak on payment failure
                updatedAt: now,
              });
            });
            results.penalized++;
          } catch (e) {
            log.error('Bot: penalty failed', e, { userId: nonPayingWinnerId });
          }
        }
      } else {
        // If no second bidder, we expire the auction
        await db.collection('auctions').doc(auctionId).update({
          status: 'EXPIRED',
          updatedAt: now,
        });
        results.failed++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    Sentry.captureException(error);
    log.error('Cron: Policy enforcement failed', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
