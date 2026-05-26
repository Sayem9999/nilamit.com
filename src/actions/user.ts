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
import { verifyAndLinkMFSAccount } from '@/actions/otp';

export async function updateProfile(data: unknown): Promise<ServiceResponse<{ user: Pick<User, 'id' | 'name' | 'email' | 'image' | 'bio' | 'banner'> }>> {
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
  if (parsed.data.bio !== undefined) update.bio   = sanitized.bio ?? null;
  // Handle image and banner separately: null means "remove" (sanitizeObject may strip nulls)
  if (parsed.data.image  !== undefined) update.image  = parsed.data.image ?? null;
  if (parsed.data.banner !== undefined) update.banner = parsed.data.banner ?? null;

  // Persist C2C localized delivery addresses and preferred disbursements
  if (parsed.data.addressStreet   !== undefined) update.addressStreet   = parsed.data.addressStreet ?? null;
  if (parsed.data.addressArea     !== undefined) update.addressArea     = parsed.data.addressArea ?? null;
  if (parsed.data.addressDistrict !== undefined) update.addressDistrict = parsed.data.addressDistrict ?? null;
  if (parsed.data.addressZip      !== undefined) update.addressZip      = parsed.data.addressZip ?? null;
  if (parsed.data.defaultPayout   !== undefined) update.defaultPayout   = parsed.data.defaultPayout ?? null;

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
      bio: userData.bio || null,
      banner: userData.banner || null,
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
export async function linkMFSAccount(
  type: 'bkash' | 'nagad',
  number: string,
  otp: string,
): Promise<ServiceResponse<null>> {
  return verifyAndLinkMFSAccount(type, number, otp);
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

export async function getTopSellers(limitCount: number = 4): Promise<ServiceResponse<Array<{
  id: string;
  name: string;
  image: string | null;
  rating: number;
  ratingCount: number;
  userLevel: number;
  salesCount: number;
  isTopRated: boolean;
}>>> {
  try {
    const snap = await db.collection("users")
      .where("isTopRated", "==", true)
      .limit(limitCount)
      .get();
    
    const sellers = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Anonymous Seller",
        image: data.image || null,
        rating: Number(data.rating || 0),
        ratingCount: Number(data.ratingCount || 0),
        userLevel: Number(data.userLevel || 1),
        salesCount: Number(data.salesCount || 0),
        isTopRated: !!data.isTopRated,
      };
    });
    
    return successResponse(sellers);
  } catch (error) {
    log.error("[user] getTopSellers failed", error);
    return errorResponse(ErrorType.INTERNAL, "Failed to load top sellers.");
  }
}

