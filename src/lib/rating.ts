'use server';

import { db } from '@/lib/db';
import { log } from '@/lib/logger';

// Bayesian prior for the global rating mean.
const BAYESIAN_PRIOR_RATING = 3.5;
const BAYESIAN_CONFIDENCE   = 5;

/**
 * Recalculate a user's Bayesian rating based on reviews.
 * Returns the new rating and updates the user document.
 */
export async function recalculateUserRating(userId: string): Promise<{ rating: number; count: number }> {
  try {
    const reviewsSnap = await db.collection('reviews').where('toId', '==', userId).get();

    const ratings = reviewsSnap.docs
      .map(d => d.data().rating)
      .filter((r): r is number => r !== null && r !== undefined);
    const v = ratings.length;
    const R = v > 0 ? ratings.reduce((a, b) => a + b, 0) / v : 0;

    // Bayesian adjustment: prevents 5.0 with only 1 review from dominating.
    const bayesianRating = (v / (v + BAYESIAN_CONFIDENCE)) * R
                    + (BAYESIAN_CONFIDENCE / (v + BAYESIAN_CONFIDENCE)) * BAYESIAN_PRIOR_RATING;
    
    const finalRating = Number(bayesianRating.toFixed(2));

    await db.collection('users').doc(userId).update({
      rating: finalRating,
      ratingCount: v,
      updatedAt: new Date(),
    });

    return { rating: finalRating, count: v };
  } catch (e) {
    log.error('[rating] recalculate failed', e, { userId });
    return { rating: BAYESIAN_PRIOR_RATING, count: 0 };
  }
}
