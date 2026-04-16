'use server';

import { db } from '@/lib/db';

/**
 * Recalculate a user's reputation score using:
 *   1. Volume-based points (sold auctions, purchases, cancellations)
 *   2. Bayesian-adjusted rating quality
 */
export async function recalculateUserReputation(userId: string): Promise<number> {
  try {
    const [soldSnap, purchasesSnap, cancelledSnap, reviewsSnap, allReviewsSnap] =
      await Promise.all([
        db.collection('auctions').where('sellerId', '==', userId).where('status', '==', 'SOLD').get(),
        db.collection('escrowTransactions').where('buyerId', '==', userId).where('status', '==', 'RELEASED').get(),
        db.collection('auctions').where('sellerId', '==', userId).where('status', '==', 'CANCELLED').get(),
        db.collection('reviews').where('toId', '==', userId).get(),
        db.collection('reviews').get(),
      ]);

    // 1. Volume points
    let points = 100;
    points += soldSnap.size    * 10;
    points += purchasesSnap.size * 5;

    // Penalty: cancelled auctions that had bids
    for (const doc of cancelledSnap.docs) {
      const a = doc.data();
      if ((a.bidCount ?? 0) > 0) points -= 50;
    }

    // 2. Bayesian rating
    const ratings = reviewsSnap.docs.map(d => d.data().rating as number).filter(Boolean);
    const v = ratings.length;
    const R = v > 0 ? ratings.reduce((a, b) => a + b, 0) / v : 0;

    const allRatings = allReviewsSnap.docs.map(d => d.data().rating as number).filter(Boolean);
    const C = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 3.5;
    const m = 5; // confidence threshold

    const bayesian  = (v / (v + m)) * R + (m / (v + m)) * C;
    const quality   = bayesian / 5;
    const finalScore = Math.max(0, Math.round(points * quality));

    await db.collection('users').doc(userId).update({
      reputationScore: finalScore,
      updatedAt: new Date(),
    });

    return finalScore;
  } catch (e) {
    console.error('[reputation] recalculate failed for', userId, e);
    return 0;
  }
}
