'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { followSellerSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { ERROR_CODES } from '@/lib/constants';

/**
 * sellerFollows doc id: `{followerId}_{sellerId}`. Composite key gives us
 * idempotent follow/unfollow without needing a query first, and lets us
 * read directly when checking "is X following Y".
 */
function followDocId(followerId: string, sellerId: string): string {
  return `${followerId}_${sellerId}`;
}

export async function followSeller(input: unknown): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  const parsed = followSellerSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const { sellerId } = parsed.data;
  const followerId = session.user.id;

  if (followerId === sellerId) {
    return errorResponse(ErrorType.VALIDATION, 'You cannot follow yourself.');
  }

  try {
    // Verify seller exists before creating the follow row.
    const sellerSnap = await db.collection('users').doc(sellerId).get();
    if (!sellerSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Seller not found');

    const id = followDocId(followerId, sellerId);
    await db.collection('sellerFollows').doc(id).set({
      id,
      followerId,
      sellerId,
      createdAt: new Date(),
    });

    revalidatePath(`/seller/${sellerId}`);
    return successResponse(null);
  } catch (error) {
    log.error('[Action] followSeller failed', error, { followerId, sellerId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to follow seller.');
  }
}

export async function unfollowSeller(input: unknown): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  const parsed = followSellerSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const { sellerId } = parsed.data;
  const followerId = session.user.id;

  try {
    await db.collection('sellerFollows').doc(followDocId(followerId, sellerId)).delete();
    revalidatePath(`/seller/${sellerId}`);
    return successResponse(null);
  } catch (error) {
    log.error('[Action] unfollowSeller failed', error, { followerId, sellerId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to unfollow seller.');
  }
}

/** Read-only: does the current viewer follow this seller? */
export async function isFollowingSeller(sellerId: string): Promise<ServiceResponse<{ following: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return successResponse({ following: false });

  try {
    const snap = await db.collection('sellerFollows').doc(followDocId(session.user.id, sellerId)).get();
    return successResponse({ following: snap.exists });
  } catch (error) {
    log.error('[Action] isFollowingSeller failed', error);
    return successResponse({ following: false });
  }
}

/** Public count of followers for a seller (badge on profile). */
export async function getFollowerCount(sellerId: string): Promise<ServiceResponse<{ count: number }>> {
  try {
    const snap = await db.collection('sellerFollows').where('sellerId', '==', sellerId).count().get();
    return successResponse({ count: snap.data().count });
  } catch (error) {
    log.error('[Action] getFollowerCount failed', error);
    return successResponse({ count: 0 });
  }
}
