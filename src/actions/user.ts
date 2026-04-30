'use server';

import { db, docData, toSellerPublic } from '@/lib/db';
import { auth } from '@/lib/auth';
import { User } from '@/types';
import { apiLimiter } from '@/lib/ratelimit';
import { sanitizeObject } from '@/lib/sanitizer';
import { headers } from 'next/headers';
import { log } from '@/lib/logger';
import { updateProfileSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

export async function updateProfile(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated.');

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await apiLimiter.limit(`user_update_${session.user.id}_${ip}`);
  if (!success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Please wait.');

  const sanitized = sanitizeObject(parsed.data);
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (sanitized.name  !== undefined) update.name  = sanitized.name;
  if (sanitized.image !== undefined) update.image = sanitized.image;

  await db.collection('users').doc(session.user.id).update(update);
  const snap = await db.collection('users').doc(session.user.id).get();
  return successResponse({ user: docData<User>(snap) });
}

export async function getPublicProfile(userId: string) {
  // Use aggregation counts instead of fetching all docs — one read per 1000 docs
  const [userSnap, auctionCountSnap, bidCountSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('auctions').where('sellerId', '==', userId).count().get(),
    db.collection('bids').where('bidderId', '==', userId).count().get(),
  ]);

  if (!userSnap.exists) return null;

  return {
    ...toSellerPublic(userId, userSnap.data()),
    _count: {
      auctionsAsSeller: auctionCountSnap.data().count,
      bids:             bidCountSnap.data().count,
    },
  };
}

export async function linkMFSAccount(type: 'bkash' | 'nagad', number: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated.');

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await apiLimiter.limit(`mfs_link_${session.user.id}_${ip}`);
  if (!success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Please wait.');

  const phoneRegex = /^01[3-9]\d{8}$/;
  if (!phoneRegex.test(number)) return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladeshi mobile number.');

  try {
    const field = type === 'bkash' ? 'bkashNumber' : 'nagadNumber';

    const existing = await db.collection('users').where(field, '==', number).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== session.user.id) {
      return errorResponse(ErrorType.CONFLICT, 'This number is already linked to another account.');
    }

    await db.collection('users').doc(session.user.id).update({
      [field]: number, updatedAt: new Date(),
    });
    return successResponse(null);
  } catch (e) {
    log.error(`[user] linkMFSAccount ${type}`, e);
    return errorResponse(ErrorType.INTERNAL, `Failed to link ${type}.`);
  }
}
