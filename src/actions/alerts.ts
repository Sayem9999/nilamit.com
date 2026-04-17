'use server';

import { db, newId } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { AlertType } from '@/types';
import { revalidatePath } from 'next/cache';

/**
 * Smart Engagement Layer - Alerts
 */

export async function createAlert(type: AlertType, auctionId?: string, thresholdPrice?: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  try {
    const id  = newId();
    const now = new Date();
    const alert = {
      id,
      userId:         session.user.id,
      type,
      auctionId:      auctionId      ?? null,
      thresholdPrice: thresholdPrice ?? null,
      isActive:       true,
      createdAt:      now,
      updatedAt:      now,
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
    .where('userId',   '==', session.user.id)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown> & { auctionId?: string | null }));

  const auctionIds = [...new Set(alerts.map(a => a.auctionId).filter((x): x is string => !!x))];
  const auctionSnaps = await Promise.all(auctionIds.map(id => db.collection('auctions').doc(id).get()));
  const auctionsMap  = new Map(auctionSnaps.filter(s => s.exists).map(s => {
    const a = s.data()!;
    return [s.id, {
      title:        a.title,
      currentPrice: a.currentPrice,
      endTime:      a.endTime?.toDate?.() ?? new Date(a.endTime),
    }];
  }));

  return alerts.map(a => ({
    ...a,
    auction: a.auctionId ? auctionsMap.get(a.auctionId) ?? null : null,
  }));
}

export async function toggleAlert(alertId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  const ref  = db.collection('alerts').doc(alertId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== session.user.id) return { success: false };

  await ref.update({ isActive, updatedAt: new Date() });
  return { success: true };
}

/**
 * Trigger Check (Logic for Price Drop alerts)
 * This would normally run in the closeAuction/placeBid logic
 */
export async function checkAndTriggerPriceAlerts(auctionId: string, currentPrice: number) {
  const snap = await db.collection('alerts')
    .where('auctionId',      '==', auctionId)
    .where('type',           '==', 'PRICE_DROP' satisfies AlertType)
    .where('isActive',       '==', true)
    .where('thresholdPrice', '>=', currentPrice)
    .get();

  const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; userId: string; [key: string]: any }));
  const userSnaps = await Promise.all(alerts.map(a => db.collection('users').doc(a.userId).get()));
  const usersMap  = new Map(userSnaps.map(s => [s.id, { email: s.data()?.email ?? null }]));

  return alerts.map(a => ({ ...a, user: usersMap.get(a.userId) ?? { email: null } }));
}
