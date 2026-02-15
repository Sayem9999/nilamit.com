'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { PlaceBidResult } from '@/types';

const SOFT_CLOSE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const SOFT_CLOSE_EXTENSION_MS = 2 * 60 * 1000; // Extend by 2 minutes

/**
 * placeBid — THE critical server action
 * 
 * Uses PostgreSQL serializable transaction + SELECT FOR UPDATE row locking
 * to prevent race conditions when 500 users bid simultaneously.
 * 
 * Anti-sniping: If bid comes in within last 2 minutes, extends auction by 2 minutes.
 */
export async function placeBid(auctionId: string, amount: number): Promise<PlaceBidResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be logged in to bid.' };
  }

  const userId = session.user.id;

  // Check phone verification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPhoneVerified: true },
  });

  if (!user?.isPhoneVerified) {
    return { success: false, error: 'PHONE_NOT_VERIFIED' };
  }

  try {
    // SERIALIZABLE transaction with row-level locking
    const result = await prisma.$transaction(async (tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      // Lock the auction row — prevents concurrent bid race conditions
      const [auction] = await tx.$queryRaw<Array<{
        id: string;
        currentPrice: number;
        minBidIncrement: number;
        endTime: Date;
        status: string;
        sellerId: string;
      }>>`
        SELECT id, "currentPrice", "minBidIncrement", "endTime", status, "sellerId"
        FROM "Auction"
        WHERE id = ${auctionId}
        FOR UPDATE
      `;

      if (!auction) {
        throw new Error('Auction not found.');
      }

      if (auction.status !== 'active') {
        throw new Error('This auction is not active.');
      }

      const now = new Date();
      if (now >= auction.endTime) {
        throw new Error('This auction has ended.');
      }

      if (auction.sellerId === userId) {
        throw new Error('You cannot bid on your own auction.');
      }

      const minRequired = auction.currentPrice + auction.minBidIncrement;
      if (amount < minRequired) {
        throw new Error(`Bid must be at least ৳${minRequired.toLocaleString()}.`);
      }

      // Create the bid
      const bid = await tx.bid.create({
        data: {
          amount,
          auctionId,
          bidderId: userId,
        },
      });

      // Anti-sniping: Soft Close logic
      const timeUntilEnd = auction.endTime.getTime() - now.getTime();
      let newEndTime = auction.endTime;
      let antiSnipeTriggered = false;

      if (timeUntilEnd <= SOFT_CLOSE_WINDOW_MS) {
        newEndTime = new Date(auction.endTime.getTime() + SOFT_CLOSE_EXTENSION_MS);
        antiSnipeTriggered = true;
      }

      // Update auction: new price + potentially extended end time
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentPrice: amount,
          endTime: newEndTime,
        },
      });

      return { bid, newEndTime, antiSnipeTriggered };
    }, {
      isolationLevel: 'Serializable',
    });

    return {
      success: true,
      bid: result.bid,
      newEndTime: result.newEndTime,
      antiSnipeTriggered: result.antiSnipeTriggered,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place bid.';
    return { success: false, error: message };
  }
}

/**
 * Get bids for an auction, ordered by most recent first
 */
export async function getAuctionBids(auctionId: string) {
  return prisma.bid.findMany({
    where: { auctionId },
    include: {
      bidder: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Get current user's bids
 */
export async function getMyBids() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.bid.findMany({
    where: { bidderId: session.user.id },
    include: {
      auction: {
        select: {
          id: true, title: true, images: true,
          currentPrice: true, endTime: true, status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
