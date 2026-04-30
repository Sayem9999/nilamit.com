'use server';

import { db, snapDocs } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { AlertType, Alert } from '@/types';
import { createAlertSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

export async function createAlert(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const parsed = createAlertSchema.safeParse(data);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  const { type, auctionId, thresholdPrice } = parsed.data;

  // Composite ID prevents duplicate alerts for the same user/auction/type
  const docId = `${session.user.id}_${auctionId ?? type}`;
  const now   = new Date();

  try {
    const alert = {
      id: docId, userId: session.user.id, type,
      auctionId:      auctionId      ?? null,
      thresholdPrice: thresholdPrice ?? null,
      isActive: true, createdAt: now, updatedAt: now,
    };
    await db.collection('alerts').doc(docId).set(alert, { merge: true });
    revalidatePath('/');
    return successResponse(alert);
  } catch (error) {
    log.error('[alerts] createAlert failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to create alert');
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

  if (snap.empty) return [];

  // Batch-fetch all referenced auctions in one round-trip instead of N+1
  const auctionIds = [
    ...new Set(snap.docs.map((d) => d.data().auctionId as string | null).filter(Boolean) as string[]),
  ];

  const auctionMap = new Map<string, FirebaseFirestore.DocumentData>();
  if (auctionIds.length > 0) {
    const aSnaps = await db.getAll(...auctionIds.map((id) => db.collection('auctions').doc(id)));
    aSnaps.forEach((s) => { if (s.exists) auctionMap.set(s.id, s.data()!); });
  }

  return snap.docs.map((d) => {
    const a         = d.data();
    const auctionId = a.auctionId as string | null;
    const auct      = auctionId ? auctionMap.get(auctionId) : null;

    return {
      ...a,
      id:        d.id,
      createdAt: a.createdAt?.toDate?.() ?? new Date(a.createdAt),
      updatedAt: a.updatedAt?.toDate?.() ?? new Date(a.updatedAt),
      auction: auct
        ? {
            id:           auctionId,
            title:        auct.title,
            currentPrice: auct.currentPrice,
            endTime:      auct.endTime?.toDate?.() ?? new Date(auct.endTime),
            status:       auct.status,
          }
        : null,
    };
  });
}

export async function toggleAlert(alertId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    const snap = await db.collection('alerts').doc(alertId).get();
    if (!snap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Alert not found');
    // Ownership check — prevents any authenticated user from toggling others' alerts
    if (snap.data()!.userId !== session.user.id) return errorResponse(ErrorType.FORBIDDEN, 'Unauthorized');

    await db.collection('alerts').doc(alertId).update({ isActive, updatedAt: new Date() });
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (error) {
    log.error('[alerts] toggleAlert failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to toggle alert');
  }
}

export async function deleteAlert(alertId: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    const snap = await db.collection('alerts').doc(alertId).get();
    if (!snap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Alert not found');
    if (snap.data()!.userId !== session.user.id) return errorResponse(ErrorType.FORBIDDEN, 'Unauthorized');

    await db.collection('alerts').doc(alertId).delete();
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (error) {
    log.error('[alerts] deleteAlert failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to delete alert');
  }
}

export async function checkAndTriggerPriceAlerts(auctionId: string, currentPrice: number) {
  const snap = await db.collection('alerts')
    .where('auctionId', '==', auctionId)
    .where('type', '==', 'PRICE_DROP' as AlertType)
    .where('isActive', '==', true)
    .where('thresholdPrice', '>=', currentPrice)
    .get();

  return snapDocs<Alert>(snap);
}
