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

export async function banUser(userId: string) {
  await requireAdmin();
  await db.collection('users').doc(userId).update({
    isBanned: true, updatedAt: new Date(),
  });
  return { success: true };
}

export async function unbanUser(userId: string) {
  await requireAdmin();
  await db.collection('users').doc(userId).update({
    isBanned: false, updatedAt: new Date(),
  });
  return { success: true };
}

export async function getAdminUsers() {
  await requireAdmin();

  const snap = await db.collection('users')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const users = await Promise.all(snap.docs.map(async d => {
    const u = d.data();
    // Count bids dynamically for UI instead of Prisma relation
    const bidsSnap = await db.collection('bids').where('bidderId', '==', d.id).get();
    return {
      ...u, id: d.id,
      createdAt: u.createdAt?.toDate?.() ?? new Date(u.createdAt),
      password: undefined, // never expose hashed password
      _count: { bids: bidsSnap.size },
      isBanned: u.isBanned || false,
    };
  }));

  return { success: true, users };
}
