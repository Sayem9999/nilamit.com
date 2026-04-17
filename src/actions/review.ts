'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { filterPII } from '@/lib/pii-filter';

export async function submitReview({
  auctionId, toId, rating, comment,
}: { auctionId: string; toId: string; rating: number; comment?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };
  const fromId = session.user.id;
  if (fromId === toId) return { success: false, error: 'You cannot review yourself' };

  // SECURITY FIX: verify caller is seller or winner of the auction
  const aSnap = await db.collection('auctions').doc(auctionId).get();
  if (!aSnap.exists) return { success: false, error: 'Auction not found' };
  const auction = aSnap.data()!;
  if (auction.status !== 'SOLD') return { success: false, error: 'Auction not yet completed' };
  if (auction.sellerId !== fromId && auction.winnerId !== fromId) {
    return { success: false, error: 'You can only review auctions you participated in' };
  }

  // Uniqueness check: one review per user per auction
  const reviewId = `${fromId}_${auctionId}`;
  const existing = await db.collection('reviews').doc(reviewId).get();
  if (existing.exists) return { success: false, error: 'You have already reviewed this auction.' };

  const now    = new Date();
  const review = {
    id: reviewId, auctionId, fromId, toId,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    comment: filterPII(comment) || null,
    createdAt: now,
  };

  await db.collection('reviews').doc(reviewId).set(review);

  // Update recipient reputation score + review aggregates
  const allReviewsSnap = await db.collection('reviews').where('toId', '==', toId).get();
  const ratings = allReviewsSnap.docs.map(d => d.data().rating as number);
  const avg     = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const newScore = Math.round((avg * 20) + (ratings.length * 2));
  await db.collection('users').doc(toId).update({
    reputationScore: newScore,
    reviewCount: ratings.length,
    averageRating: Math.round(avg * 10) / 10,
    updatedAt: now,
  });

  revalidatePath(`/profile/${toId}`);
  revalidatePath(`/auctions/${auctionId}`);
  return { success: true, review };
}

export async function getUserReviews(userId: string) {
  const snap = await db.collection('reviews')
    .where('toId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return Promise.all(snap.docs.map(async d => {
    const r = d.data();
    const [fromSnap, aSnap] = await Promise.all([
      db.collection('users').doc(r.fromId).get(),
      db.collection('auctions').doc(r.auctionId).get(),
    ]);
    return { ...r, id: d.id,
      createdAt: r.createdAt?.toDate?.() ?? new Date(r.createdAt),
      from:    { id: r.fromId, name: fromSnap.data()?.name ?? null, image: fromSnap.data()?.image ?? null },
      auction: { title: aSnap.data()?.title ?? '' } };
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
