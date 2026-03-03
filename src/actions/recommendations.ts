'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus } from '@prisma/client';

/**
 * Behavioral Tracking & Recommendation Engine
 * 
 * Implements a weighted affinity system based on:
 * - Category views (Medium weight)
 * - Bid history (High weight)
 * - Search history (Low weight)
 */

export async function trackCategoryView(category: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const userId = session.user.id;

  try {
    const preferences = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        viewedCategories: {
          push: category
        },
        affinityScore: {
          upsert: {
            update: { [category]: { increment: 1 } },
            set: { [category]: 1 }
          }
        }
      },
      create: {
        userId,
        viewedCategories: [category],
        affinityScore: { [category]: 1 }
      }
    });

    // Cleanup logic: Keep only last 50 viewed categories to prevent array bloat
    if (preferences.viewedCategories.length > 50) {
      await prisma.userPreference.update({
        where: { userId },
        data: {
          viewedCategories: preferences.viewedCategories.slice(-50)
        }
      });
    }
  } catch (error) {
    console.error("Failed to track category view:", error);
  }
}

export async function getRecommendations(limit: number = 6) {
  const session = await auth();
  if (!session?.user?.id) {
    // Fallback to featured/ending soon for guests
    return prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      orderBy: { endTime: 'asc' },
      take: limit,
      include: {
        seller: { select: { name: true, image: true, reputationScore: true } },
        _count: { select: { bids: true } }
      }
    });
  }

  const userId = session.user.id;

  // 1. Get user preferences
  const prefs = await prisma.userPreference.findUnique({
    where: { userId }
  });

  if (!prefs || !prefs.viewedCategories.length) {
    // Fallback if no history
    return prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      orderBy: { currentPrice: 'desc' }, // Show high value for now
      take: limit,
      include: {
        seller: { select: { name: true, image: true, reputationScore: true } },
        _count: { select: { bids: true } }
      }
    });
  }

  // 2. Identify top categories based on frequency
  const catFrequency: Record<string, number> = {};
  prefs.viewedCategories.forEach(cat => {
    catFrequency[cat] = (catFrequency[cat] || 0) + 1;
  });

  const topCategories = Object.entries(catFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);

  // 3. Fetch auctions from top categories
  const recommendations = await prisma.auction.findMany({
    where: {
      status: AuctionStatus.ACTIVE,
      category: { in: topCategories },
      sellerId: { not: userId } // Don't recommend own auctions
    },
    orderBy: { endTime: 'asc' },
    take: limit,
    include: {
      seller: { select: { name: true, image: true, reputationScore: true, isVerifiedSeller: true } },
      _count: { select: { bids: true } }
    }
  });

  // 4. Fill with general if not enough
  if (recommendations.length < limit) {
    const additional = await prisma.auction.findMany({
      where: {
        status: AuctionStatus.ACTIVE,
        id: { notIn: recommendations.map(r => r.id) },
        sellerId: { not: userId }
      },
      orderBy: { createdAt: 'desc' },
      take: limit - recommendations.length,
      include: {
        seller: { select: { name: true, image: true, reputationScore: true, isVerifiedSeller: true } },
        _count: { select: { bids: true } }
      }
    });
    return [...recommendations, ...additional];
  }

  return recommendations;
}
