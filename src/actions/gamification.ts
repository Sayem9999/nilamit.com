"use server";

import { prisma } from "@/lib/db";
import { pusherServer } from "@/lib/pusher-server";

export type BadgeType = "early_bird" | "sniper" | "whale" | "first_blood";

interface BadgeConfig {
  id: BadgeType;
  name: string;
  description: string;
  icon: string; // Emoji for simple UI
}

export const BADGE_CONFIG: Record<BadgeType, BadgeConfig> = {
  first_blood: {
    id: "first_blood",
    name: "First Blood",
    description: "Placed the very first bid on an auction.",
    icon: "🩸",
  },
  early_bird: {
    id: "early_bird",
    name: "Early Bird",
    description: "Placed a bid within the first hour of an auction.",
    icon: "🌅",
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    description: "Placed a bid in the final 2 minutes of an auction.",
    icon: "🎯",
  },
  whale: {
    id: "whale",
    name: "Whale",
    description: "Placed a bid of 100,000 BDT or more.",
    icon: "🐋",
  },
};

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
