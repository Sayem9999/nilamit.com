'use server';

import { db, newId } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Smart Engagement Layer - Alerts
 */

export async function createAlert(type: AlertType, auctionId?: string, thresholdPrice?: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  try {
    const id = newId();
    const alert = {
      id,
      userId: session.user.id,
      type,
      auctionId,
      thresholdPrice,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('alerts').doc(id).set(alert);

    revalidatePath('/');
    return { success: true, alert };
  } catch {
    return { success: false, error: "Failed to create alert" };
  }
}

export async function getUserAlerts() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const snap = await db.collection('alerts')
    .where('userId', '==', session.user.id)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  const alerts = await Promise.all(snap.docs.map(async d => {
    const a = d.data();
    let auctionData = null;
    if (a.auctionId) {
      const auctSnap = await db.collection('auctions').doc(a.auctionId).get();
      if (auctSnap.exists) {
        const auct = auctSnap.data()!;
        auctionData = { title: auct.title, currentPrice: auct.currentPrice, endTime: auct.endTime };
      }
    }
    return { ...a, id: d.id, auction: auctionData };
  }));
  return alerts;
}

export async function toggleAlert(alertId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await db.collection('alerts').doc(alertId).update({ isActive, updatedAt: new Date() });

  return { success: true };
}

/**
 * Trigger Check (Logic for Price Drop alerts)
 * This would normally run in the closeAuction/placeBid logic
 */
export async function checkAndTriggerPriceAlerts(auctionId: string, currentPrice: number) {
  const snap = await db.collection('alerts')
    .where('auctionId', '==', auctionId)
    .where('type', '==', 'PRICE_DROP')
    .where('isActive', '==', true)
    .where('thresholdPrice', '>=', currentPrice)
    .get();

  const matchingAlerts = snap.docs.map(d => ({ ...d.data(), id: d.id }));

  // In a real app, this would send emails/push notifications
  return matchingAlerts;
}
