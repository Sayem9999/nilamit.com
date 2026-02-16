'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Submit a review for an auction
 */
export async function submitReview({
  auctionId,
  toId,
  rating,
  comment
}: {
  auctionId: string;
  toId: string;
  rating: number;
  comment?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  const fromId = session.user.id;

  if (fromId === toId) {
    return { success: false, error: 'You cannot review yourself' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the review
      const review = await tx.review.create({
        data: {
          auctionId,
          fromId,
          toId,
          rating,
          comment,
        }
      });

      // 2. Calculate new reputation score for the recipient
      const aggregate = await tx.review.aggregate({
        where: { toId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const avgRating = aggregate._avg.rating || 0;
      const totalReviews = aggregate._count.rating || 0;

      // Simple score: Average * 10 + bonus for volume
      const newScore = Math.round((avgRating * 20) + (totalReviews * 2));

      // 3. Update the user's score
      await tx.user.update({
        where: { id: toId },
        data: { reputationScore: newScore }
      });

      return review;
    });

    revalidatePath(`/profile/${toId}`);
    revalidatePath(`/auctions/${auctionId}`);
    
    return { success: true, review: result };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'You have already reviewed this auction.' };
    }
    return { success: false, error: error.message || 'Failed to submit review' };
  }
}

/**
 * Get reviews received by a user
 */
export async function getUserReviews(userId: string) {
  return prisma.review.findMany({
    where: { toId: userId },
    include: {
      from: {
        select: {
          id: true,
          name: true,
          image: true,
        }
      },
      auction: {
        select: {
          title: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Check if a user can review a specific auction/user
 */
export async function canReviewAuction(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      status: true,
      sellerId: true,
      winnerId: true,
    }
  });

  if (!auction || auction.status !== 'SOLD') return false;

  const isSeller = auction.sellerId === session.user.id;
  const isWinner = auction.winnerId === session.user.id;

  if (!isSeller && !isWinner) return false;

  // Check if already reviewed
  const existing = await prisma.review.findUnique({
    where: {
      fromId_auctionId: {
        fromId: session.user.id,
        auctionId,
      }
    }
  });

  return !existing;
}
