'use server';

import { db, newId, docData, snapDocs } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { AlertType, Alert } from '@/types';
import { log } from '@/lib/logger';

/**
 * Smart Engagement Layer - Alerts
 */

export interface CreateAlertData {
  type: string;
  auctionId?: string;
  thresholdPrice?: number;
}

export async function createAlert(data: CreateAlertData) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  // Use a composite ID to prevent duplicate alerts for the same user/auction/type
  const docId = `${session.user.id}_${data.auctionId ?? data.type}`;
  const now = new Date();
  
  try {
    const alert = {
      id: docId,
      userId: session.user.id,
      type: data.type,
      auctionId: data.auctionId ?? null,
      thresholdPrice: data.thresholdPrice ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('alerts').doc(docId).set(alert, { merge: true });

    revalidatePath('/');
    return { success: true, alert };
  } catch (error) {
    log.error('[alerts] createAlert failed', error);
    return { success: false, error: 'Failed to create alert' };
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

  return Promise.all(snap.docs.map(async d => {
    const a = d.data();
    const auctionId = a.auctionId;
    let auction = null;
    
    if (auctionId) {
      const aSnap = await db.collection('auctions').doc(auctionId).get();
      if (aSnap.exists) {
        const auct = aSnap.data()!;
        auction = {
          id: aSnap.id,
          title: auct.title,
          currentPrice: auct.currentPrice,
          endTime: auct.endTime?.toDate?.() ?? new Date(auct.endTime),
          status: auct.status,
        };
      }
    }
    
    return {
      ...a,
      id: d.id,
      createdAt: a.createdAt?.toDate?.() ?? new Date(a.createdAt),
      updatedAt: a.updatedAt?.toDate?.() ?? new Date(a.updatedAt),
      auction,
    };
  }));
}

export async function toggleAlert(alertId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    await db.collection('alerts').doc(alertId).update({ 
      isActive, 
      updatedAt: new Date() 
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to toggle alert' };
  }
}

export async function deleteAlert(alertId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const snap = await db.collection('alerts').doc(alertId).get();
    if (!snap.exists) return { success: false, error: 'Alert not found' };
    if (snap.data()!.userId !== session.user.id) return { success: false, error: 'Unauthorized' };

    await db.collection('alerts').doc(alertId).delete();
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete alert' };
  }
}

/**
 * Trigger Check (Logic for Price Drop alerts)
 * Used in background tasks or triggers.
 */
export async function checkAndTriggerPriceAlerts(auctionId: string, currentPrice: number) {
  const snap = await db.collection('alerts')
    .where('auctionId', '==', auctionId)
    .where('type', '==', 'PRICE_DROP')
    .where('isActive', '==', true)
    .where('thresholdPrice', '>=', currentPrice)
    .get();

  return snapDocs<Alert>(snap);
}
