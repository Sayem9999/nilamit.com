'use server';

import { db, docData, toSellerPublic } from '@/lib/db';
import { auth } from '@/lib/auth';
import { User } from '@/types';

import { apiLimiter } from '@/lib/ratelimit';
import { sanitizeObject } from '@/lib/sanitizer';
import { headers } from 'next/headers';
import { log } from '@/lib/logger';

export async function updateProfile(data: { name?: string; image?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await apiLimiter.limit(`user_update_${session.user.id}_${ip}`);
  if (!success) return { success: false, error: 'Too many requests. Please wait.' };

  const sanitized = sanitizeObject(data);
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (sanitized.name)  update.name  = sanitized.name;
  if (sanitized.image) update.image = sanitized.image;

  await db.collection('users').doc(session.user.id).update(update);
  const snap = await db.collection('users').doc(session.user.id).get();
  return { success: true, user: docData<User>(snap) };
}

export async function getPublicProfile(userId: string) {
  const [userSnap, auctionsSnap, bidsSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('auctions').where('sellerId', '==', userId).get(),
    db.collection('bids').where('bidderId', '==', userId).get(),
  ]);

  if (!userSnap.exists) return null;
  
  return {
    ...toSellerPublic(userId, userSnap.data()),
    _count: { auctionsAsSeller: auctionsSnap.size, bids: bidsSnap.size },
  };
}

export async function linkMFSAccount(type: 'bkash' | 'nagad', number: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await apiLimiter.limit(`mfs_link_${session.user.id}_${ip}`);
  if (!success) return { success: false, error: 'Too many requests. Please wait.' };

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
    log.error(`[user] linkMFSAccount ${type}`, e);
    return { success: false, error: `Failed to link ${type}.` };
  }
}
