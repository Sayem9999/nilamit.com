'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { PlaceBidResult } from '@/types';
import { pusherServer } from '@/lib/pusher-server';
import { ERROR_CODES, SOFT_CLOSE_WINDOW_MS, SOFT_CLOSE_EXTENSION_MS } from '@/lib/constants';
import { checkAndAwardBadges } from './gamification';
import { processAuctionSale } from '@/lib/auction-logic';

const PlaceBidSchema = z.object({
  auctionId: z.string().cuid(),
  amount: z.number().positive(),
});

/**
 * placeBid — THE critical server action
 * 
 * Uses PostgreSQL serializable transaction + SELECT FOR UPDATE row locking
 * to prevent race conditions when 500 users bid simultaneously.
 * 
 * Anti-sniping: If bid comes in within last 2 minutes, extends auction by 2 minutes.
 */
export async function placeBid(auctionId: string, amount: number): Promise<PlaceBidResult> {
  // 1. Validation
  const validation = PlaceBidSchema.safeParse({ auctionId, amount });
  if (!validation.success) {
    return { success: false, error: ERROR_CODES.VALIDATION_ERROR };
  }

  // 2. Authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };
  }

  const userId = session.user.id;

  // 3. User Checks (Phone verification & Bid Deposits)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      isPhoneVerified: true,
      isVerifiedSeller: true,
      bidDeposits: { 
        where: { auctionId, status: 'held' } 
      }
    },
  });

  if (!user) {
    return { success: false, error: ERROR_CODES.NOT_FOUND };
  }

  if (!user.isPhoneVerified) {
    return { success: false, error: ERROR_CODES.PHONE_NOT_VERIFIED };
  }

  // Phase 2: High-stakes Bid Deposit Check
  if (amount >= 10000) {
    // If not a verified seller/user AND no deposit held, block the bid
    if (!user.isVerifiedSeller && (!user.bidDeposits || user.bidDeposits.length === 0)) {
      return { 
        success: false, 
        error: ERROR_CODES.DEPOSIT_REQUIRED,
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
        startTime: Date;
      }>>`
        SELECT id, title, "currentPrice", "minBidIncrement", "endTime", status, "sellerId", "startTime"
        FROM "Auction"
        WHERE id = ${auctionId}
        FOR UPDATE
      `;

      if (!auction) {
        throw new Error(ERROR_CODES.NOT_FOUND);
      }

      if (auction.status !== 'ACTIVE') {
        throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      }

      const now = new Date();
      if (now >= auction.endTime) {
        throw new Error(ERROR_CODES.AUCTION_ENDED);
      }

      if (auction.sellerId === userId) {
        throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);
      }

      const minRequired = auction.currentPrice + auction.minBidIncrement;
      if (amount < minRequired) {
        throw new Error(`${ERROR_CODES.BID_TOO_LOW}: ৳${minRequired.toLocaleString()}`);
      }

      // Identify previous high bidder for notification
      const prevBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: { amount: 'desc' },
        include: { bidder: { select: { id: true, email: true, name: true, phone: true } } },
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

      // Phase 7: Real-time Proactive Alerts (eBay Standard)
      // Identify all users set for alerts on this auction
      const alertsToTrigger = await tx.alert.findMany({
        where: {
          auctionId,
          isActive: true,
          OR: [
            { type: 'OUTBID' },
            { type: 'TARGET_REACHED', thresholdPrice: { lte: amount } }
          ],
          userId: { not: userId } // Self-notify exclusion
        }
      });

      // Deactivate TARGET_REACHED alerts once hit (One-time trigger)
      const targetAlertIds = alertsToTrigger
        .filter(a => a.type === 'TARGET_REACHED')
        .map(a => a.id);

      if (targetAlertIds.length > 0) {
        await tx.alert.updateMany({
          where: { id: { in: targetAlertIds } },
          data: { isActive: false }
        });
      }

      return { 
        bid, 
        newEndTime, 
        antiSnipeTriggered, 
        prevBidder: prevBid?.bidder,
        prevBidderId: prevBid?.bidderId,
        auctionTitle: auction.title,
        timeUntilEnd: timeUntilEnd,
        auctionStartTime: auction.startTime,
        triggeredAlerts: alertsToTrigger
      };
    }, {
      isolationLevel: 'Serializable',
    });

    // Send Outbid Notification (Async & Real-time)
    if (result.prevBidder?.email && result.prevBidder.email !== session.user.email) {
      sendOutbidEmail(result.prevBidder.email, result.auctionTitle, amount, auctionId).catch(console.error);
    }
    
    // Proactive Alerts Trigger
    if (result.triggeredAlerts && result.triggeredAlerts.length > 0) {
      await Promise.all(result.triggeredAlerts.map(alert => 
        pusherServer.trigger(`user-${alert.userId}`, 'price-alert', {
          auctionId,
          auctionTitle: result.auctionTitle,
          amount,
          type: alert.type,
          threshold: alert.thresholdPrice
        })
      )).catch(console.error);
    }

    if (result.prevBidderId && result.prevBidderId !== session.user.id) {
      await pusherServer.trigger(`user-${result.prevBidderId}`, 'outbid-alert', {
        auctionId,
        auctionTitle: result.auctionTitle,
        amount,
        newBidderName: session.user.name || undefined
      }).catch(console.error);
    }

    // Phase 4: Push Real-time Updates to Presence Channel
    await pusherServer.trigger(`presence-auction-${auctionId}`, 'new-bid', {
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

    // Gamification Hook - Run asynchronously so it doesn't block the bid response length
    checkAndAwardBadges(
      userId,
      auctionId,
      amount,
      result.antiSnipeTriggered,
      result.auctionStartTime
    ).catch(console.error);

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
 * executeBuyItNow — Instant purchase
 * 
 * Bypasses bidding, sets status to SOLD, creates Escrow.
 */
export async function executeBuyItNow(auctionId: string): Promise<PlaceBidResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };
  }

  const userId = session.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        select: {
          id: true,
          title: true,
          buyItNowPrice: true,
          status: true,
          sellerId: true,
          endTime: true,
          startTime: true,
          deliveryCharge: true,
          seller: { select: { id: true, isVerifiedSeller: true } }
        },
      });

      if (!auction || !auction.buyItNowPrice) {
        throw new Error("This auction does not support Buy It Now.");
      }

      if (auction.status !== 'ACTIVE') {
        throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      }

      if (auction.sellerId === userId) {
        throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);
      }

      const binAmount = auction.buyItNowPrice;

      // Create winner bid
      const bid = await tx.bid.create({
        data: {
          amount: binAmount,
          auctionId,
          bidderId: userId,
        },
      });

      // Centralized Sale Processing
      await processAuctionSale(
        tx,
        auction,
        auction.seller,
        { 
          id: userId, 
          email: session.user.email || null, 
          name: session.user.name || null 
        },
        binAmount
      );

      return { 
        bid, 
        auctionTitle: auction.title,
        binAmount
      };
    });

    // Real-time Updates
    await pusherServer.trigger(`presence-auction-${auctionId}`, 'auction-sold', {
      winnerName: session.user.name || 'Someone',
      price: result.binAmount,
    }).catch(console.error);

    await pusherServer.trigger('global-ticker', 'new-activity', {
      bidder: session.user.name || 'Someone',
      auctionTitle: result.auctionTitle,
      amount: result.binAmount,
      auctionId,
      type: 'BIN'
    }).catch(console.error);

    return {
      success: true,
      bid: result.bid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute Buy It Now.';
    return { success: false, error: message };
  }
}

async function sendOutbidEmail(email: string, title: string, currentPrice: number, auctionId: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const { Resend } = await import('resend');
  const { outbidEmailHtml } = await import('@/lib/emails');
  const resend = new Resend(resendApiKey);
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nilamit.com';

  await resend.emails.send({
    from: 'notifications@nilamit.com',
    to: email,
    subject: `You've been outbid on: ${title}`,
    html: outbidEmailHtml(title, currentPrice, auctionId, baseUrl),
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
