'use server';

import { db, snapDocs } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { filterPII } from '@/lib/pii-filter';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import type { Review } from '@/types';

export async function submitReview({
  auctionId, toId, rating, comment,
}: { auctionId: string; toId: string; rating: number; comment?: string }) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  const fromId = session.user.id;
  if (fromId === toId) return errorResponse(ErrorType.FORBIDDEN, 'You cannot review yourself');

  const aSnap = await db.collection('auctions').doc(auctionId).get();
  if (!aSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
  const auction = aSnap.data()!;
  if (auction.status !== 'SOLD') return errorResponse(ErrorType.FORBIDDEN, 'Auction not yet completed');
  if (auction.sellerId !== fromId && auction.winnerId !== fromId) {
    return errorResponse(ErrorType.FORBIDDEN, 'You can only review auctions you participated in');
  }

  // Composite doc ID — one review per user per auction, idempotent
  const reviewId = `${fromId}_${auctionId}`;
  const existing = await db.collection('reviews').doc(reviewId).get();
  if (existing.exists) return errorResponse(ErrorType.CONFLICT, 'You have already reviewed this auction.');

  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
  const now    = new Date();
  const review = {
    id: reviewId, auctionId, fromId, toId,
    rating: clampedRating,
    comment: filterPII(comment) || null,
    createdAt: now,
  };

  try {
    await db.collection('reviews').doc(reviewId).set(review);

    // Reputation: cap at the 100 most recent reviews to avoid unbounded scans.
    // The formula rewards both quality (avg) and volume (log-scaled count).
    const allReviewsSnap = await db.collection('reviews')
      .where('toId', '==', toId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const ratings  = allReviewsSnap.docs.map(d => d.data().rating as number);
    const avg      = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const newScore = Math.round((avg * 15) + (Math.log10(ratings.length + 1) * 20));

    await db.collection('users').doc(toId).update({ reputationScore: newScore, updatedAt: now });

    revalidatePath(`/profile/${toId}`);
    revalidatePath(`/auctions/${auctionId}`);
    return successResponse(review);
  } catch (e) {
    log.error('[review] submitReview failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to submit review');
  }
}

export async function getUserReviews(userId: string) {
  const snap = await db.collection('reviews')
    .where('toId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const reviews = snapDocs<Review>(snap);
  if (reviews.length === 0) return [];

  // Batch-fetch reviewers and auctions in two round-trips instead of N+1
  const fromIds    = [...new Set(reviews.map(r => r.fromId))];
  const auctionIds = [...new Set(reviews.map(r => r.auctionId))];

  const [fromSnaps, auctionSnaps] = await Promise.all([
    db.getAll(...fromIds.map(id => db.collection('users').doc(id))),
    db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id))),
  ]);

  const fromMap = new Map(fromSnaps.map(s => [s.id, s.data() ?? {}]));
  const aMap    = new Map(auctionSnaps.map(s => [s.id, s.data() ?? {}]));

  return reviews.map(r => ({
    ...r,
    from: {
      id:    r.fromId,
      name:  (fromMap.get(r.fromId)?.name  as string | null) ?? 'User',
      image: (fromMap.get(r.fromId)?.image as string | null) ?? null,
    },
    auction: {
      title: (aMap.get(r.auctionId)?.title as string | undefined) ?? 'Archived Auction',
    },
  }));
}

export async function canReviewAuction(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const aSnap = await db.collection('auctions').doc(auctionId).get();
  if (!aSnap.exists) return false;
  const a = aSnap.data()!;
  if (a.status !== 'SOLD') return false;
  if (a.sellerId !== session.user.id && a.winnerId !== session.user.id) return false;

  const existing = await db.collection('reviews').doc(`${session.user.id}_${auctionId}`).get();
  return !existing.exists;
}
