'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { PlaceBidResult } from '@/types';
import { pusherServer } from '@/lib/pusher-server';

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

  // Phase 2: High-stakes Bid Deposit Check
  if (amount >= 10000) {
    const fullUser = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: { isVerifiedSeller: true, bidDeposits: { where: { auctionId, status: 'held' } } }
    });
    
    // If not a verified seller/user AND no deposit held, block the bid
    if (!fullUser?.isVerifiedSeller && (!fullUser?.bidDeposits || fullUser.bidDeposits.length === 0)) {
      return { 
        success: false, 
        error: 'DEPOSIT_REQUIRED',
        // Note: In a real app, we'd return a link to the deposit page
      };
    }
  }

  try {
    // SERIALIZABLE transaction with row-level locking
    const result = await prisma.$transaction(async (tx) => {
      // Lock the auction row — prevents concurrent bid race conditions
      const [auction] = await tx.$queryRaw<Array<{
        id: string;
        title: string;
        currentPrice: number;
        minBidIncrement: number;
        endTime: Date;
        status: string;
        sellerId: string;
      }>>`
        SELECT id, title, "currentPrice", "minBidIncrement", "endTime", status, "sellerId"
        FROM "Auction"
        WHERE id = ${auctionId}
        FOR UPDATE
      `;

      if (!auction) {
        throw new Error('Auction not found.');
      }

      if (auction.status !== 'ACTIVE') {
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

      // Identify previous high bidder for notification
      const prevBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: { amount: 'desc' },
        include: { bidder: { select: { email: true, name: true, phone: true } } },
      });

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

      return { 
        bid, 
        newEndTime, 
        antiSnipeTriggered, 
        prevBidder: prevBid?.bidder,
        auctionTitle: auction.title,
        timeUntilEnd: timeUntilEnd
      };
    }, {
      isolationLevel: 'Serializable',
    });

    // Send Outbid Notification (Async)
    if (result.prevBidder?.email && result.prevBidder.email !== session.user.email) {
      sendOutbidEmail(result.prevBidder.email, result.auctionTitle, amount, auctionId).catch(console.error);
    }

    // Phase 4: Push Real-time Updates
    await pusherServer.trigger(`auction-${auctionId}`, 'new-bid', {
      amount,
      endTime: result.newEndTime,
      bidderName: session.user.name || 'Someone',
    }).catch(console.error);

    // Global Ticker Update
    await pusherServer.trigger('global-ticker', 'new-activity', {
      bidder: session.user.name || 'Someone',
      auctionTitle: result.auctionTitle,
      amount,
      auctionId,
    }).catch(console.error);

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


async function sendOutbidEmail(email: string, title: string, currentPrice: number, auctionId: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);

  await resend.emails.send({
    from: 'notifications@nilamit.com', // Update once domain is verified
    to: email,
    subject: `You've been outbid on: ${title}`,
    html: `
      <h2>You've been outbid!</h2>
      <p>Someone placed a higher bid on <strong>${title}</strong>.</p>
      <p>Current high bid: <strong>৳${currentPrice.toLocaleString()}</strong></p>
      <p><a href="${process.env.NEXTAUTH_URL}/auctions/${auctionId}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Bid Again Now</a></p>
    `,
  });
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
