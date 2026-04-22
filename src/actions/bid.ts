'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { bidLimiter } from '@/lib/ratelimit';
import { ERROR_CODES } from '@/lib/constants';
import { BiddingService } from '@/services/bidding/bidding-service';
import * as Sentry from '@sentry/nextjs';
import { log } from '@/lib/logger';

/**
 * Server Action: Place a bid on an auction
 */
export async function placeBid(auctionId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };
  const userId = session.user.id;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await bidLimiter.limit(`bid_${userId}_${ip}`);
  if (!rateLimitSuccess) return { success: false, error: 'Too many bids placed rapidly. Please wait a moment.' };

  try {
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return { success: false, error: ERROR_CODES.NOT_FOUND };
    const user = userSnap.data()!;

    if (!user.isPhoneVerified) return { success: false, error: ERROR_CODES.PHONE_NOT_VERIFIED };
    if (user.isBanned) return { success: false, error: 'Your account has been banned for policy violations.' };
    if (user.isMinor) return { success: false, error: 'Users under 18 are not eligible to place binding bids.' };

    // Elite deposit check
    if (amount >= 100000 && !user.isVerifiedSeller) {
      const depositSnap = await db.collection('bidDeposits')
        .where('bidderId', '==', userId)
        .where('auctionId', '==', auctionId)
        .where('status', '==', 'held')
        .limit(1).get();
      if (depositSnap.empty) return { success: false, error: ERROR_CODES.ELITE_DEPOSIT_REQUIRED };
    }

    return await BiddingService.placeBid(auctionId, amount, userId, session.user.name || 'Someone', session.user.email || '');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place bid.';
    log.error('placeBid failed', error, { userId, auctionId, amount });
    return { success: false, error: message };
  }
}

/**
 * Server Action: Fetch bid history for an auction
 */
export async function getAuctionBids(auctionId: string) {
  try {
    return await BiddingService.getAuctionBids(auctionId);
  } catch (error) {
    console.error('[Action] getAuctionBids failed:', error);
    return [];
  }
}
