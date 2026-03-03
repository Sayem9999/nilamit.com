"use server";

import { prisma } from "@/lib/db";
import { pusherServer } from "@/lib/pusher-server";

import type { BadgeType } from "@/lib/gamification-config";
import { BADGE_CONFIG } from "@/lib/gamification-config";

/**
 * Evaluates the current bid/auction context and awards badges if applicable.
 * Called immediately after a successful bid.
 */
export async function checkAndAwardBadges(
  userId: string,
  auctionId: string,
  bidAmount: number,
  isSnipe: boolean,
  auctionStartTime: Date,
) {
  try {
    const badgesToAward: BadgeType[] = [];

    // 1. Check Sniper
    if (isSnipe) {
      badgesToAward.push("sniper");
    }

    // 2. Check Whale
    if (bidAmount >= 100000) {
      badgesToAward.push("whale");
    }

    // 3. Check Early Bird (within 1 hour)
    const now = new Date();
    const oneHourMs = 60 * 60 * 1000;
    if (now.getTime() - auctionStartTime.getTime() <= oneHourMs) {
      badgesToAward.push("early_bird");
    }

    // 4. Check First Blood (was this the first bid?)
    const bidCount = await prisma.bid.count({
      where: { auctionId },
    });
    // This hook runs *after* the bid is placed, so bidCount will be at least 1
    if (bidCount === 1) {
      badgesToAward.push("first_blood");
    }

    // Attempt to award each badge (unique constraint handles duplicates)
    for (const badge of badgesToAward) {
      const existing = await prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge,
          },
        },
      });

      if (!existing) {
        await prisma.userBadge.create({
          data: {
            userId,
            badgeId: badge,
          },
        });

        // Notify user in real-time about their new badge
        await pusherServer
          .trigger(`user-${userId}`, "badge-earned", {
            badge: BADGE_CONFIG[badge],
          })
          .catch(console.error);
      }
    }
  } catch (error) {
    console.error("Failed to process badges:", error);
    // Silent fail – gamification shouldn't break core auction flow
  }
}
