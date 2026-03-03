'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { AlertType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

/**
 * Smart Engagement Layer - Alerts
 */

export async function createAlert(type: AlertType, auctionId?: string, thresholdPrice?: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  try {
    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        type,
        auctionId,
        thresholdPrice,
      }
    });

    revalidatePath('/');
    return { success: true, alert };
  } catch {
    return { success: false, error: "Failed to create alert" };
  }
}

export async function getUserAlerts() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.alert.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      auction: { select: { title: true, currentPrice: true, endTime: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function toggleAlert(alertId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await prisma.alert.update({
    where: { id: alertId, userId: session.user.id },
    data: { isActive }
  });

  return { success: true };
}

/**
 * Trigger Check (Logic for Price Drop alerts)
 * This would normally run in the closeAuction/placeBid logic
 */
export async function checkAndTriggerPriceAlerts(auctionId: string, currentPrice: number) {
  const matchingAlerts = await prisma.alert.findMany({
    where: {
      auctionId,
      type: "PRICE_DROP" as AlertType,
      isActive: true,
      thresholdPrice: { gte: currentPrice }
    },
    include: { user: { select: { email: true } } }
  });

  // In a real app, this would send emails/push notifications
  return matchingAlerts;
}
