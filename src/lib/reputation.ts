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
    cancelledAuctions,
    completedPurchases,
    reviews
  ] = await Promise.all([
    // Auctions sold by user
    prisma.auction.count({ where: { sellerId: userId, status: AuctionStatus.SOLD } }),
    // Auctions cancelled by user (with bids)
    prisma.auction.count({ 
      where: { 
        sellerId: userId, 
        status: AuctionStatus.CANCELLED,
        bids: { some: {} } 
      } 
    }),
    // User won and "processed" (assuming logic handles RECEIVED status)
    prisma.auction.count({ where: { winnerId: userId, status: AuctionStatus.SOLD } }), 
    // Aggregate reviews
    prisma.review.aggregate({
      where: { toId: userId },
      _avg: { rating: true },
      _count: true
    })
  ]);

  /**
   * BASE SCORE CALCULATION
   * Start at 100.
   * +10 for every successful sale.
   * +5 for every successful purchase.
   * -50 for every cancelled auction with bids (sabotage penalty).
   * Review Multiplier: average rating / 5
   */
  
  let baseScore = 100;
  baseScore += (soldAuctions * 10);
  baseScore += (completedPurchases * 5);
  baseScore -= (cancelledAuctions * 50);

  const avgRating = reviews._avg.rating || 5;
  const reviewWeight = Math.max(0.2, avgRating / 5); // Minimum 20% of base score if bad reviews

  const finalScore = Math.round(baseScore * reviewWeight);

  // Update user profile
  await prisma.user.update({
    where: { id: userId },
    data: { reputationScore: Math.max(0, finalScore) } // Never below 0
  });

  return finalScore;
}
