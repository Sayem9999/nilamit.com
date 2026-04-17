'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

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
    console.error('[admin-content] getSystemConfig failed:', e);
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

export async function toggleFeaturedAuction(auctionId: string) {
  await requireAdmin();
  const ref = db.collection('auctions').doc(auctionId);
  const snap = await ref.get();
  const current = Boolean(snap.data()?.isFeatured);
  const next = !current;
  await ref.update({ isFeatured: next, updatedAt: new Date() });
  revalidatePath('/');
  return { success: true, isFeatured: next };
}

export async function getFeaturedAuctions() {
  const snap = await db.collection('auctions')
    .where('isFeatured', '==', true)
    .where('status', '==', 'ACTIVE')
    .orderBy('endTime', 'asc')
    .get();

  return snap.docs.map(d => ({
    ...d.data(), id: d.id,
    endTime: d.data().endTime?.toDate?.() ?? new Date(d.data().endTime),
  } as any));
}
