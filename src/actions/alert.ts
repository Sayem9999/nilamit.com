'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createAlert(data: {
  auctionId?: string; type: string; thresholdPrice?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const docId = `${session.user.id}_${data.auctionId ?? data.type}`;
  const now   = new Date();
  await db.collection('alerts').doc(docId).set({
    id: docId, userId: session.user.id,
    auctionId: data.auctionId ?? null,
    type: data.type,
    thresholdPrice: data.thresholdPrice ?? null,
    isActive: true, createdAt: now, updatedAt: now,
  }, { merge: true });

  return { success: true };
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
    const a      = d.data();
    const aSnap  = a.auctionId ? await db.collection('auctions').doc(a.auctionId).get() : null;
    return {
      ...a, id: d.id,
      createdAt: a.createdAt?.toDate?.() ?? new Date(a.createdAt),
      auction: aSnap?.exists ? { id: aSnap.id, title: aSnap.data()?.title, status: aSnap.data()?.status } : null,
    };
  }));
}

export async function deleteAlert(alertId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const snap = await db.collection('alerts').doc(alertId).get();
  if (!snap.exists) return { success: false, error: 'Alert not found' };
  if (snap.data()!.userId !== session.user.id) return { success: false, error: 'Unauthorized' };

  await db.collection('alerts').doc(alertId).delete();
  revalidatePath('/dashboard');
  return { success: true };
}
