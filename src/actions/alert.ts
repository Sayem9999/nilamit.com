'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { AlertType } from '@prisma/client';

export async function createAlert({
  auctionId,
  type,
  thresholdPrice
}: {
  auctionId: string;
  type: AlertType;
  thresholdPrice?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if alert already exists for this type/auction
    const existing = await prisma.alert.findFirst({
      where: { userId, auctionId, type, isActive: true }
    });

    if (existing) {
      // Update existing
      const updated = await prisma.alert.update({
        where: { id: existing.id },
        data: { thresholdPrice }
      });
      revalidatePath(`/auction/${auctionId}`);
      return { success: true, alert: updated };
    }

    const newAlert = await prisma.alert.create({
      data: {
        userId,
        auctionId,
        type,
        thresholdPrice,
      },
    });

    revalidatePath(`/auction/${auctionId}`);
    return { success: true, alert: newAlert };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Create alert error:', err);
    return { success: false, error: 'Failed to create alert: ' + err.message };
  }
}

export async function getUserAlerts() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized', data: [] };
    }

    const alerts = await prisma.alert.findMany({
      where: { userId: session.user.id, isActive: true },
      include: {
        auction: {
          select: { title: true, currentPrice: true, endTime: true, id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: alerts };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get user alerts error:', err);
    return { success: false, error: 'Failed to retrieve alerts: ' + err.message, data: [] };
  }
}

export async function deleteAlert(alertId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ownership
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert || alert.userId !== session.user.id) {
      return { success: false, error: 'Alert not found or unauthorized' };
    }

    await prisma.alert.delete({
      where: { id: alertId },
    });

    if (alert.auctionId) {
      revalidatePath(`/auction/${alert.auctionId}`);
    }
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Delete alert error:', err);
    return { success: false, error: 'Failed to delete alert: ' + err.message };
  }
}
