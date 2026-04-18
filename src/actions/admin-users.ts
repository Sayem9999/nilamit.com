'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { NIDStatus } from '@/types';

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

// ─── NID Verification Review ────────────────────────────────────────────────

export async function getPendingNIDSubmissions() {
  try {
    await requireAdmin();
    const snap = await db.collection('users')
      .where('nidStatus', '==', NIDStatus.PENDING)
      .orderBy('nidSubmittedAt', 'asc')
      .limit(100)
      .get();
    const submissions = snap.docs.map(d => {
      const u = d.data();
      return {
        id:              d.id,
        name:            (u.name as string | null) ?? null,
        email:           (u.email as string | null) ?? null,
        image:           (u.image as string | null) ?? null,
        phone:           (u.phone as string | null) ?? null,
        isPhoneVerified: Boolean(u.isPhoneVerified),
        nidLast4:        (u.nidLast4 as string | null) ?? null,
        nidSubmittedAt:  u.nidSubmittedAt?.toDate?.() ?? u.nidSubmittedAt ?? null,
        nidFrontPath:    (u.nidFrontPath as string | null) ?? null,
        nidBackPath:     (u.nidBackPath as string | null) ?? null,
      };
    });
    return { success: true as const, submissions };
  } catch (e) {
    return { success: false as const, submissions: [], error: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function approveNIDSubmission(userId: string) {
  await requireAdmin();
  const now = new Date();
  await db.collection('users').doc(userId).update({
    nidStatus:          NIDStatus.APPROVED,
    isNIDVerified:      true,
    isVerifiedSeller:   true, // Approved NID auto-grants seller badge
    nidReviewedAt:      now,
    nidRejectionReason: null,
    updatedAt:          now,
  });
  return { success: true };
}

export async function rejectNIDSubmission(userId: string, reason: string) {
  await requireAdmin();
  const cleaned = reason.trim().slice(0, 500);
  if (!cleaned) return { success: false, error: 'Rejection reason is required.' };
  const now = new Date();
  await db.collection('users').doc(userId).update({
    nidStatus:          NIDStatus.REJECTED,
    isNIDVerified:      false,
    nidReviewedAt:      now,
    nidRejectionReason: cleaned,
    updatedAt:          now,
  });
  return { success: true };
}
