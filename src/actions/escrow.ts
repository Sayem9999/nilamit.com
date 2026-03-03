'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function simulateEscrowPayment(transactionId: string) {
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
      return { success: false, error: 'Payment has already been processed' };
    }

    // Update Transaction to RELEASED
    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'RELEASED',
        paymentMethod: 'sandbox_test_payment_method',
      },
    });

    // Mark Auction as fully paid (we'll just use the status or delivery flow conceptually)
    await prisma.auction.update({
      where: { id: tx.auctionId },
      data: {
        deliveryStatus: 'PENDING', // Next step in C2C logic
      },
    });

    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (error) {
    console.error('Failed to simulate payment:', error);
    return { success: false, error: 'Internal server error during simulation' };
  }
}
