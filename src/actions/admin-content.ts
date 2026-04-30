'use server';

import { db, snapDocs } from '@/lib/db';
import { Auction, SystemConfig } from '@/types';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

export async function getSystemConfig(): Promise<ServiceResponse<SystemConfig>> {
  try {
    const snap = await db.collection('systemConfig').doc('default').get();
    if (!snap.exists) {
      return successResponse({
        id: 'default', heroTitle: '', heroSubtitle: '', heroImage: null,
        announcement: null, showAnnouncement: false,
        treasuryBkash: null, treasuryNagad: null,
        updatedAt: new Date(),
      });
    }
    return successResponse({ ...snap.data(), id: snap.id } as SystemConfig);
  } catch (e) {
    log.error('[admin-content] getSystemConfig failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch system config');
  }
}

export async function updateSystemConfig(data: {
  heroTitle?: string; heroSubtitle?: string; heroImage?: string;
  announcement?: string; showAnnouncement?: boolean;
  treasuryBkash?: string; treasuryNagad?: string;
}): Promise<ServiceResponse<null>> {
  try {
    await requireAdmin();
    await db.collection('systemConfig').doc('default').set(
      { ...data, id: 'default', updatedAt: new Date() }, { merge: true }
    );
    revalidatePath('/');
    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    log.error('[admin-content] updateSystemConfig failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Update failed');
  }
}

export async function toggleFeaturedAuction(auctionId: string, featured: boolean): Promise<ServiceResponse<null>> {
  try {
    await requireAdmin();
    await db.collection('auctions').doc(auctionId).update({
      isFeatured: featured, updatedAt: new Date(),
    });
    revalidatePath('/');
    return successResponse(null);
  } catch (e) {
    log.error('[admin-content] toggleFeaturedAuction failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Toggle failed');
  }
}

export async function getFeaturedAuctions(): Promise<ServiceResponse<Auction[]>> {
  try {
    const snap = await db.collection('auctions')
      .where('isFeatured', '==', true)
      .where('status', '==', 'ACTIVE')
      .orderBy('endTime', 'asc')
      .get();
    return successResponse(snapDocs<Auction>(snap));
  } catch (e) {
    log.error('[admin-content] getFeaturedAuctions failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch featured auctions');
  }
}
