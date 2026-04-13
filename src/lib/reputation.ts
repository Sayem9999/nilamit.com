'use server';

import { prisma } from '@/lib/db';
import { AuctionStatus } from '@prisma/client';

/**
 * Reputation Algorithm (Trust 2.0)
 * 
 * Logic to calculate and update user reputation based on:
 * - Successful auctions (Seller)
 * - Compassion rate (Winner payment reliability)
 * - Review ratings
 * - Penalty for cancellations (Auction sabotage prevention)
 */

export async function recalculateUserReputation(userId: string) {
  const [
    soldAuctions,
    cancelledWithBids,
    completedPurchases,
    reviews,
    globalStats
  ] = await Promise.all([
    // Auctions sold by user (RELEASED = successful COD)
    prisma.escrowTransaction.count({ where: { auction: { sellerId: userId }, status: 'RELEASED' } }),
    // Auctions cancelled by user (with bids) - sabotage penalty
    prisma.auction.count({ 
      where: { 
        sellerId: userId, 
        status: 'CANCELLED',
        bids: { some: {} } 
      } 
    }),
    // User won and verified receipt
    prisma.escrowTransaction.count({ where: { buyerId: userId, status: 'RELEASED' } }), 
    // Aggregate reviews for this user
    prisma.review.aggregate({
      where: { toId: userId },
      _avg: { rating: true },
      _count: true
    }),
    // Global mean rating for Bayesian calculation
    prisma.review.aggregate({
      _avg: { rating: true }
    })
  ]);

  /**
   * 1. POINT-BASED TRUST (VOLUME)
   * Sales have higher weight than purchases.
   */
  let points = 100; // Base score
  points += (soldAuctions * 10);
  points += (completedPurchases * 5);
  points -= (cancelledWithBids * 50);

  /**
   * 2. BAYESIAN RATING (QUALITY)
   * Formula: (v / (v + m)) * R + (m / (v + m)) * C
   * v = count of reviews
   * m = minimum reviews for confidence (e.g., 5)
   * R = user average
   * C = global average
   */
  const v = reviews._count || 0;
  const m = 5; 
  const R = reviews._avg.rating || 5;
  const C = globalStats._avg.rating || 4.5;

  const bayesianRating = (v / (v + m)) * R + (m / (v + m)) * C;

  /**
   * 3. FINAL REPUTATION SCORE
   * Combined volume and quality. 
   * A "5" rating means 100% of points. A "4" means 80%.
   */
  const qualityMultiplier = bayesianRating / 5;
  const finalScore = Math.round(points * qualityMultiplier);

  // Update user profile
  await prisma.user.update({
    where: { id: userId },
    data: { 
      reputationScore: Math.max(0, finalScore),
      // Future: winningStreak update could go here
    }
  });

  return {
    score: Math.max(0, finalScore),
    bayesianRating,
    points
  };
}
