"use server";

import { GamificationService } from "@/services/gamification/gamification-service";

export async function checkAndAwardBadges(
  userId: string,
  auctionId: string,
  amount: number,
  antiSnipeTriggered: boolean,
  auctionStartTime: Date,
) {
  return GamificationService.checkAndAwardBadges(userId, auctionId, amount, antiSnipeTriggered, auctionStartTime);
}

/**
 * Award XP and update streaks after a successful sale
 */
export async function processSaleGamification(winnerId: string, sellerId: string) {
  return GamificationService.processSaleGamification(winnerId, sellerId);
}
