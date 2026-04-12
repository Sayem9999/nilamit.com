'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Transitions from PENDING -> HELD (The "Advance" payment)
 * Reveals contact information and secures the delivery fee/success fee.
 */
export async function payEscrowAdvance(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const tx = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.buyerId !== session.user.id) {
      return { success: false, error: 'Transaction not found or unauthorized' };
    }

    if (tx.status !== 'PENDING') {
      return { success: false, error: 'Advance has already been paid' };
    }

    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'HELD',
        paymentMethod: 'bkash_sim_advance',
      },
    });

    revalidatePath('/dashboard');
    revalidatePath(`/auctions/${tx.auctionId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to pay advance:', error);
    return { success: false, error: 'Internal error during advance payment' };
  }
}

/**
 * Transitions from HELD -> RELEASED (Final Confirmation)
 * Usually triggered by the buyer after receiving the item.
 */
export async function confirmItemReceived(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const tx = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
      include: { auction: true },
    });

    if (!tx || tx.buyerId !== session.user.id) {
      return { success: false, error: 'Transaction not found or unauthorized' };
    }

    if (tx.status !== 'HELD') {
      return { success: false, error: 'Funds must be in HELD status to release' };
    }

    // Update Transaction to RELEASED
    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'RELEASED',
        paymentMethod: 'sandbox_test_release',
      },
    });

    // Mark Auction as fully delivered
    await prisma.auction.update({
      where: { id: tx.auctionId },
      data: {
        deliveryStatus: 'DELIVERED', 
      },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to confirm delivery:', error);
    return { success: false, error: 'Internal error during delivery confirmation' };
  }
}

/**
 * Refunds an escrow payment and waives the platform fee.
 * (Admin or Dispute Resolution context)
 */
export async function refundEscrow(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const tx = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) return { success: false, error: 'Transaction not found' };

    // Update Transaction to FEE_REFUNDED (waives the service fee logic)
    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'FEE_REFUNDED',
      },
    });

    // Mark Auction as CANCELLED
    await prisma.auction.update({
      where: { id: tx.auctionId },
      data: {
        status: 'CANCELLED',
      },
    });

    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (error) {
    console.error('Failed to refund escrow:', error);
    return { success: false, error: 'Internal server error during refund' };
  }
}
