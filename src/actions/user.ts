'use server';

import { db, toSellerPublic } from '@/lib/db';
import { auth } from '@/lib/auth';
import { User, PublicProfile } from '@/types';
import { apiLimiter } from '@/lib/ratelimit';
import { sanitizeObject } from '@/lib/sanitizer';
import { headers } from 'next/headers';
import { log } from '@/lib/logger';
import { updateProfileSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

export async function updateProfile(data: unknown): Promise<ServiceResponse<{ user: Pick<User, 'id' | 'name' | 'email' | 'image'> }>> {
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
  // Handle image separately: null means "remove photo" (sanitizeObject may strip nulls)
  if (parsed.data.image !== undefined) update.image = parsed.data.image ?? null;

  await db.collection('users').doc(session.user.id).update(update);
  
  // Return only safe fields to the client
  const snap = await db.collection('users').doc(session.user.id).get();
  const userData = snap.data();
  if (!userData) return errorResponse(ErrorType.NOT_FOUND, 'User not found');

  return successResponse({ 
    user: {
      id: snap.id,
      name: userData.name || null,
      image: userData.image || null,
      email: userData.email || null,
    } 
  });
}


export async function getPublicProfile(userId: string): Promise<ServiceResponse<PublicProfile | null>> {
  try {
    // Use aggregation counts instead of fetching all docs — one read per 1000 docs
    const [userSnap, auctionCountSnap, bidCountSnap] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('auctions').where('sellerId', '==', userId).count().get(),
      db.collection('bids').where('bidderId', '==', userId).count().get(),
    ]);

    if (!userSnap.exists) return successResponse(null);

    const seller = toSellerPublic(userId, userSnap.data());
    if (!seller) return successResponse(null);

    return successResponse({
      ...seller,
      _count: {
        auctionsAsSeller: auctionCountSnap.data().count,
        bids:             bidCountSnap.data().count,
      },
    });
  } catch (e) {
    log.error('[user] getPublicProfile failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch profile');
  }
}
export async function linkMFSAccount(type: 'bkash' | 'nagad', number: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated.');

  const normalizedNumber = number.startsWith('+88') ? number : `+88${number}`;
  const mfsRegex = /^\+8801[3-9]\d{8}$/;
  if (!mfsRegex.test(normalizedNumber)) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladeshi mobile number. Format: 01XXXXXXXXX or +8801XXXXXXXXX');
  }
  const validatedNumber = normalizedNumber;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await apiLimiter.limit(`mfs_link_${session.user.id}_${ip}`);
  if (!success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Please wait.');

  try {
    const field = type === 'bkash' ? 'bkashNumber' : 'nagadNumber';
    const userRef = db.collection('users').doc(session.user.id);

    const result = await db.runTransaction(async (tx) => {
      const query = db.collection('users').where(field, '==', validatedNumber).limit(1);
      const existing = await tx.get(query);
      if (!existing.empty && existing.docs[0].id !== session.user.id) {
        return { error: 'CONFLICT' };
      }
      tx.update(userRef, {
        [field]: validatedNumber,
        updatedAt: new Date(),
      });
      return { success: true };
    });

    if (result.error === 'CONFLICT') {
      return errorResponse(ErrorType.CONFLICT, 'This number is already linked to another account.');
    }

    return successResponse(null);
  } catch (e) {
    log.error(`[user] linkMFSAccount ${type}`, e);
    return errorResponse(ErrorType.INTERNAL, `Failed to link ${type}.`);
  }
}

import { unstable_cache } from 'next/cache';

export async function getCurrentUserVerification(): Promise<ServiceResponse<{ isEmailVerified: boolean; isBanned: boolean; isVerifiedSeller: boolean; isAdmin: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated.');

  try {
    // Cache the verification status for 30 seconds to avoid hammering DB on every guard mount
    const fetchVerification = unstable_cache(
      async (userId: string) => {
        const snap = await db.collection('users').doc(userId).get();
        if (!snap.exists) return null;
        const u = snap.data()!;
        const { isAdminEmail } = await import('@/lib/admin-guard');
        return {
          isEmailVerified: u.emailVerified != null,
          isBanned: !!u.isBanned,
          isVerifiedSeller: !!u.isVerifiedSeller,
          isAdmin: !!u.isAdmin || isAdminEmail(u.email || ''),
        };
      },
      [`user-verification-${session.user.id}`],
      { revalidate: 30, tags: [`user-${session.user.id}`] }
    );

    const data = await fetchVerification(session.user.id);
    if (!data) return errorResponse(ErrorType.NOT_FOUND, 'User not found');
    
    return successResponse(data);
  } catch (e) {
    log.error('[user] getCurrentUserVerification failed', e, { area: 'auth', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}

