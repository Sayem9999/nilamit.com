'use server';

import { db, snapDocs } from '@/lib/db';
import { Auction } from '@/types';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';



export async function getSystemConfig() {
  try {
    const snap = await db.collection('systemConfig').doc('default').get();
    if (!snap.exists) {
      return {
        id: 'default', heroTitle: '', heroSubtitle: '', heroImage: null,
        announcement: null, showAnnouncement: false,
        treasuryBkash: null, treasuryNagad: null,
      };
    }
    return { ...snap.data(), id: snap.id };
  } catch (e) {
    log.error('[admin-content] getSystemConfig failed', e);
    return {
      id: 'default', heroTitle: '', heroSubtitle: '', heroImage: null,
      announcement: null, showAnnouncement: false,
      treasuryBkash: null, treasuryNagad: null,
    };
  }
}

export async function updateSystemConfig(data: {
  heroTitle?: string; heroSubtitle?: string; heroImage?: string;
  announcement?: string; showAnnouncement?: boolean;
  treasuryBkash?: string; treasuryNagad?: string;
}) {
  await requireAdmin();
  await db.collection('systemConfig').doc('default').set(
    { ...data, id: 'default', updatedAt: new Date() }, { merge: true }
  );
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function toggleFeaturedAuction(auctionId: string, featured: boolean) {
  await requireAdmin();
  await db.collection('auctions').doc(auctionId).update({
    isFeatured: featured, updatedAt: new Date(),
  });
  revalidatePath('/');
  return { success: true };
}

export async function getFeaturedAuctions() {
  const snap = await db.collection('auctions')
    .where('isFeatured', '==', true)
    .where('status', '==', 'ACTIVE')
    .orderBy('endTime', 'asc')
    .get();

  return snapDocs<Auction>(snap);
}

