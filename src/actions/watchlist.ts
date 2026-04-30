"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ErrorType, errorResponse, successResponse } from "@/lib/errors";

export async function isWatched(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;
  const snap = await db.collection('watchlist').doc(`${session.user.id}_${auctionId}`).get();
  return snap.exists;
}

export async function toggleWatchlist(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const docId = `${session.user.id}_${auctionId}`;
  const ref   = db.collection('watchlist').doc(docId);
  const snap  = await ref.get();

  if (snap.exists) {
    await ref.delete();
    revalidatePath(`/auctions/${auctionId}`);
    return successResponse({ watching: false });
  } else {
    await ref.set({
      id: docId, userId: session.user.id, auctionId, createdAt: new Date(),
    });
    revalidatePath(`/auctions/${auctionId}`);
    return successResponse({ watching: true });
  }
}

export async function getWatchlist() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const snap = await db.collection('watchlist')
    .where('userId', '==', session.user.id)
    .orderBy('createdAt', 'desc')
    .get();

  if (snap.empty) return [];

  // Batch-fetch all referenced auctions in one round-trip instead of N+1
  const auctionIds = [...new Set(snap.docs.map(d => d.data().auctionId as string))];
  const aSnaps     = await db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id)));
  const aMap       = new Map(aSnaps.map(s => [s.id, s.exists ? { ...s.data(), id: s.id } : null]));

  return snap.docs.map(d => {
    const w = d.data();
    return { ...w, id: d.id, auction: aMap.get(w.auctionId) ?? null };
  });
}
