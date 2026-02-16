'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * toggleWatchlist — Add or remove an auction from user watchlist
 */
export async function toggleWatchlist(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be logged in to watch auctions.' };
  }

  const userId = session.user.id;

  try {
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_auctionId: { userId, auctionId },
      },
    });

    if (existing) {
      await prisma.watchlist.delete({
        where: { id: existing.id },
      });
      revalidatePath(`/auctions/${auctionId}`);
      return { success: true, watched: false };
    } else {
      await prisma.watchlist.create({
        data: { userId, auctionId },
      });
      revalidatePath(`/auctions/${auctionId}`);
      return { success: true, watched: true };
    }
  } catch (error) {
    return { success: false, error: 'Failed to update watchlist.' };
  }
}

/**
 * getMyWatchlist — Fetch items user is currently watching
 */
export async function getMyWatchlist() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.watchlist.findMany({
    where: { userId: session.user.id },
    include: {
      auction: {
        include: {
          seller: { select: { name: true, image: true } },
          _count: { select: { bids: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * isWatched — Check if user is watching a specific auction
 */
export async function isWatched(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const count = await prisma.watchlist.count({
    where: {
      userId: session.user.id,
      auctionId,
    },
  });

  return count > 0;
}
