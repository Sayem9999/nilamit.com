'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

export async function grantVerifiedSeller(userId: string) {
  await requireAdmin();
  await db.collection('users').doc(userId).update({
    isVerifiedSeller: true, updatedAt: new Date(),
  });
  return { success: true };
}

export async function revokeVerifiedSeller(userId: string) {
  await requireAdmin();
  await db.collection('users').doc(userId).update({
    isVerifiedSeller: false, updatedAt: new Date(),
  });
  return { success: true };
}

export async function getAdminUsers() {
  try {
    await requireAdmin();

    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const users = snap.docs.map(d => ({
      ...d.data(), id: d.id,
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt),
      password: undefined,
    } as any));

    return { success: true, users };
  } catch (e) {
    return { success: false, users: [] as any[], error: e instanceof Error ? e.message : 'Failed' };
  }
}
