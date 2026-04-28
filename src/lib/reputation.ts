'use server';

import { db } from '@/lib/db';
import { log } from '@/lib/logger';

// Bayesian prior for the global rating mean. Used as the shrinkage target
// for users with few reviews. Computing this dynamically previously meant
// scanning the entire `reviews` collection on every recalc — which fires
// twice per escrow release. A fixed prior is the standard production
// approach: the value matters far less than its consistency, and the
// confidence weight `m` already controls how fast a user's rating moves
// away from the prior as they accumulate real reviews.
const BAYESIAN_PRIOR_RATING = 3.5;
const BAYESIAN_CONFIDENCE   = 5;

/**
 * Recalculate a user's reputation score using:
 *   1. Volume-based points (sold auctions, purchases, cancellations)
 *   2. Bayesian-adjusted rating quality
 */
export async function recalculateUserReputation(userId: string): Promise<number> {
  try {
    const [soldSnap, purchasesSnap, cancelledSnap, reviewsSnap] =
      await Promise.all([
        db.collection('auctions').where('sellerId', '==', userId).where('status', '==', 'SOLD').get(),
        db.collection('escrowTransactions').where('buyerId', '==', userId).where('status', '==', 'RELEASED').get(),
        db.collection('auctions').where('sellerId', '==', userId).where('status', '==', 'CANCELLED').get(),
        db.collection('reviews').where('toId', '==', userId).get(),
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

    const bayesian  = (v / (v + BAYESIAN_CONFIDENCE)) * R
                    + (BAYESIAN_CONFIDENCE / (v + BAYESIAN_CONFIDENCE)) * BAYESIAN_PRIOR_RATING;
    const quality   = bayesian / 5;
    const finalScore = Math.max(0, Math.round(points * quality));

    await db.collection('users').doc(userId).update({
      reputationScore: finalScore,
      updatedAt: new Date(),
    });

    return finalScore;
  } catch (e) {
    log.error('[reputation] recalculate failed', e, { userId });
    return 0;
  }
}
