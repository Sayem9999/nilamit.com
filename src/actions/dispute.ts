'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DisputeStatus, EscrowStatus } from '@prisma/client';

export async function raiseDispute(transactionId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    // @ts-expect-error: Prisma schema sync lag
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
      include: { dispute: true },
    });

    if (!transaction) return { success: false, error: 'Transaction not found' };
    if (transaction.buyerId !== session.user.id) return { success: false, error: 'Unauthorized' };
    if (transaction.status !== 'HELD') return { success: false, error: 'Dispute can only be raised for funds held in escrow.' };
    if (transaction.dispute) return { success: false, error: 'Dispute already exists for this transaction.' };

    await prisma.$transaction([
      // @ts-expect-error: Prisma schema sync lag
      prisma.escrowTransaction.update({
        where: { id: transactionId },
        data: { status: 'DISPUTED' as EscrowStatus },
      }),
      // @ts-expect-error: Prisma schema sync lag
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
  // @ts-expect-error: isAdmin is added to session in auth.ts
  const isAdmin = session.user.isAdmin;
  if (!isAdmin) return { success: false, error: 'Unauthorized: Admin only' };

  try {
    // @ts-expect-error: Prisma schema sync lag
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { transaction: true },
    });

    if (!dispute) return { success: false, error: 'Dispute not found' };
    if (dispute.status !== 'OPEN') return { success: false, error: 'Dispute already resolved' };

    const transactionId = dispute.transactionId;
    const finalEscrowStatus = ruling === 'SELLER' ? 'RELEASED' : 'REFUNDED';
    const finalDisputeStatus = ruling === 'SELLER' ? DisputeStatus.RESOLVED_SELLER : DisputeStatus.RESOLVED_BUYER;

    await prisma.$transaction([
      // @ts-expect-error: Prisma schema sync lag
      prisma.escrowTransaction.update({
        where: { id: transactionId },
        data: { status: finalEscrowStatus as EscrowStatus },
      }),
      // @ts-expect-error: Prisma schema sync lag
      prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: finalDisputeStatus,
          resolution,
        },
      }),
    ]);

    revalidatePath('/admin/disputes');
    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (error) {
    console.error('Failed to resolve dispute:', error);
    return { success: false, error: 'Failed to resolve dispute' };
  }
}

export async function getOpenDisputes() {
  const session = await auth();
  // @ts-expect-error: isAdmin is added to session in auth.ts
  const isAdmin = session?.user?.isAdmin;
  if (!isAdmin) return [];

  // @ts-expect-error: Prisma schema sync lag
  return prisma.dispute.findMany({
    where: { status: 'OPEN' as DisputeStatus },
    include: {
      transaction: {
        include: {
          auction: { select: { title: true } },
          buyer: { select: { name: true, email: true } },
        }
      },
      opener: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
