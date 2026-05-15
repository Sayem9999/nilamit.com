import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuctionService } from '@/services/auction/auction-service';
import { calculateLevel } from '@/lib/gamification-engine';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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

    const auction = doc.data()!;
    // If it's no longer AWAITING_PAYMENT, the user paid (or it was already processed). No-op.
    if (auction.status !== 'AWAITING_PAYMENT') {
      log.info(`[Tasks:enforce-policies] Auction ${auctionId} is no longer AWAITING_PAYMENT. Status is ${auction.status}. No action taken.`);
      return NextResponse.json({ success: true, message: 'Policy already satisfied or irrelevant' });
    }

    const nonPayingWinnerId = auction.currentBidderId as string | undefined;

    // Trigger Second Chance Offer or expire the auction
    const offerRes = await AuctionService.createSecondChanceOffer(auctionId);
    let penaltyApplied = false;

    if (offerRes.success) {
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
              updatedAt:      new Date(),
            });
          });
          penaltyApplied = true;
        } catch (e) {
          log.error('[Tasks:enforce-policies] Penalty failed', e, { userId: nonPayingWinnerId });
        }
      }
    } else {
      await db.collection('auctions').doc(auctionId).update({
        status: 'EXPIRED', updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      secondChanceOffered: offerRes.success,
      penaltyApplied,
      processedAt: new Date().toISOString(),
    });

  } catch (error) {
    log.error('[Tasks:enforce-policies] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
