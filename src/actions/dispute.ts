'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DisputeStatus, EscrowStatus } from '@prisma/client';
import { recalculateUserReputation } from '@/lib/reputation';

export async function raiseDispute(transactionId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
      include: { dispute: true },
    });

    if (!transaction) return { success: false, error: 'Transaction not found' };
    if (transaction.buyerId !== session.user.id) return { success: false, error: 'Unauthorized' };
    if (transaction.status !== 'HELD') return { success: false, error: 'Dispute can only be raised for funds held in escrow.' };
    if (transaction.dispute) return { success: false, error: 'Dispute already exists for this transaction.' };

    await prisma.$transaction([
      prisma.escrowTransaction.update({
        where: { id: transactionId },
        data: { status: 'DISPUTED' as EscrowStatus },
      }),
      prisma.dispute.create({
        data: {
          transactionId,
          openerId: session.user.id,
          reason,
          status: 'OPEN' as DisputeStatus,
        },
      }),
    ]);

    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (error) {
    console.error('Failed to raise dispute:', error);
    return { success: false, error: 'Failed to raise dispute' };
  }
}

export async function resolveDispute(disputeId: string, ruling: 'SELLER' | 'BUYER', resolution: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  // Admin Check
  const isAdmin = session.user.isAdmin;
  if (!isAdmin) return { success: false, error: 'Unauthorized: Admin only' };

  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { transaction: true },
    });

    if (!dispute) return { success: false, error: 'Dispute not found' };
    if (dispute.status !== 'OPEN') return { success: false, error: 'Dispute already resolved' };

    const transactionId = dispute.transactionId;
    const finalEscrowStatus = ruling === 'SELLER' ? 'RELEASED' : 'REFUNDED';
    const finalDisputeStatus = ruling === 'SELLER' ? DisputeStatus.RESOLVED_SELLER : DisputeStatus.RESOLVED_BUYER;

    const res = await prisma.$transaction(async (tx) => {
      await tx.escrowTransaction.update({
        where: { id: transactionId },
        data: { 
          status: finalEscrowStatus as EscrowStatus,
        },
      });
      
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: finalDisputeStatus,
          resolution,
        },
      });

      // Recalculate trust for both parties
      const buyerId = dispute.transaction.buyerId;
      const sellerId = dispute.transaction.auction.sellerId;
      
      await recalculateUserReputation(buyerId);
      await recalculateUserReputation(sellerId);

      return true;
    });

    revalidatePath('/admin/disputes');
    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (error) {
    console.error('Failed to resolve dispute:', error);
    return { success: false, error: 'Failed to resolve dispute' };
  }
}

/**
 * Manual Admin Override: Refund Escrow
 * Used for cancellations or system errors where funds must be returned to buyer.
 */
export async function adminRefundEscrow(transactionId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: { 
        status: 'REFUNDED' as EscrowStatus,
        updatedAt: new Date(),
      },
    });

    // Log the override if a system log exists
    console.log(`[Admin] Transaction ${transactionId} refunded. Reason: ${reason}`);

    revalidatePath('/admin/escrow');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to refund escrow.' };
  }
}

export async function getOpenDisputes() {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin;
  if (!isAdmin) return [];

  return prisma.dispute.findMany({
    where: { status: 'OPEN' as DisputeStatus },
    include: {
      transaction: {
        include: {
          auction: { select: { title: true, seller: { select: { name: true } } } },
          buyer: { select: { name: true, email: true } },
        }
      },
      opener: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
