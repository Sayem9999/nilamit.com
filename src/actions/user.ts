'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function updateProfile(data: { name?: string; image?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name)  update.name  = data.name;
  if (data.image) update.image = data.image;

  await db.collection('users').doc(session.user.id).update(update);
  const snap = await db.collection('users').doc(session.user.id).get();
  return { success: true, user: { ...snap.data(), id: snap.id } };
}

export async function getPublicProfile(userId: string) {
  const [userSnap, auctionsSnap, bidsSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('auctions').where('sellerId', '==', userId).get(),
    db.collection('bids').where('bidderId', '==', userId).get(),
  ]);

  if (!userSnap.exists) return null;
  const u = userSnap.data()!;
  return {
    id: userId, name: u.name ?? null, image: u.image ?? null,
    reputationScore: u.reputationScore ?? 0, isPhoneVerified: u.isPhoneVerified ?? false,
    createdAt: u.createdAt?.toDate?.() ?? new Date(u.createdAt),
    _count: { auctionsAsSeller: auctionsSnap.size, bids: bidsSnap.size },
  };
}

export async function linkMFSAccount(type: 'bkash' | 'nagad', number: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const phoneRegex = /^01[3-9]\d{8}$/;
  if (!phoneRegex.test(number)) return { success: false, error: 'Invalid Bangladeshi mobile number.' };

  try {
    const field = type === 'bkash' ? 'bkashNumber' : 'nagadNumber';

    // Check uniqueness
    const existing = await db.collection('users').where(field, '==', number).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== session.user.id) {
      return { success: false, error: `This number is already linked to another account.` };
    }

    await db.collection('users').doc(session.user.id).update({
      [field]: number, updatedAt: new Date(),
    });
    return { success: true };
  } catch (e) {
    console.error(`[user] linkMFSAccount ${type}:`, e);
    return { success: false, error: `Failed to link ${type}.` };
  }
}
