'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { bidLimiter } from '@/lib/ratelimit';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';

/**
 * Records a 1% security-deposit *intent* for an Elite auction (৳150k+).
 *
 * IMPORTANT: this does NOT collect money and does NOT grant the elite-bid
 * waiver on its own. The deposit is written as PENDING and only counts toward
 * the elite gate (which looks for status === 'held') once a real MFS/gateway
 * payment is verified — the same manual-verification model used for escrow
 * advances. Previously this fabricated a `status: 'held'` record with no
 * payment, letting anyone bypass the ৳150k trust gate for free.
 */
export async function createBidDeposit(auctionId: string, bidAmount: number) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  const userId = session.user.id;

  if (typeof auctionId !== 'string' || auctionId.trim().length === 0) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auction.');
  }
  if (typeof bidAmount !== 'number' || !Number.isFinite(bidAmount) || bidAmount <= 0) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid bid amount.');
  }

  // Fail-closed rate limit — this touches the money/trust path.
  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const { success: ok } = await bidLimiter.limit(`deposit_${userId}_${ip}`);
  if (!ok) return errorResponse(ErrorType.RATE_LIMIT, 'Too many attempts. Please wait a moment.');

  const depositAmount = Math.floor(bidAmount * 0.01);

  try {
    const auctionSnap = await db.collection('auctions').doc(auctionId).get();
    if (!auctionSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');

    const ref = `DEP-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    await db.collection('bidDeposits').add({
      auctionId,
      bidderId: userId,
      amount: depositAmount,
      // PENDING until a real payment is verified. The elite gate requires
      // status 'held', which only a verified payment may set.
      status: 'PENDING',
      providerRef: ref,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath(`/auctions/${auctionId}`);
    return successResponse({ amount: depositAmount, ref, status: 'PENDING' as const });
  } catch (e) {
    log.error('[deposit] createBidDeposit failed', e, { userId, auctionId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to create deposit');
  }
}
