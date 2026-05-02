'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import { randomUUID } from 'crypto';

/**
 * Creates a 1% security deposit for an Elite auction.
 */
export async function createBidDeposit(auctionId: string, bidAmount: number) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const userId = session.user.id;
  const depositAmount = Math.floor(bidAmount * 0.01);

  try {
    const auctionRef = db.collection('auctions').doc(auctionId);
    const auctionSnap = await auctionRef.get();
    if (!auctionSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');

    const ref = `DEP-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    // In a real app, this would redirect to bKash/Nagad. 
    // Here we simulate successful payment by creating the document directly.
    await db.collection('bidDeposits').add({
      auctionId,
      bidderId: userId,
      amount: depositAmount,
      status: 'held',
      providerRef: ref,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath(`/auctions/${auctionId}`);
    return successResponse({ amount: depositAmount, ref });
  } catch (e) {
    console.error('[deposit] createBidDeposit failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to create deposit');
  }
}
