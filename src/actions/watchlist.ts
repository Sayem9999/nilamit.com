"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function isWatched(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;
  const snap = await db.collection('watchlist').doc(`${session.user.id}_${auctionId}`).get();
  return snap.exists;
}

export async function toggleWatchlist(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  const docId = `${session.user.id}_${auctionId}`;
  const ref   = db.collection('watchlist').doc(docId);
  const snap  = await ref.get();

  if (snap.exists) {
    await ref.delete();
    revalidatePath(`/auctions/${auctionId}`);
    return { success: true, watching: false };
  } else {
    await ref.set({
      id: docId, userId: session.user.id, auctionId, createdAt: new Date(),
    });
    revalidatePath(`/auctions/${auctionId}`);
    return { success: true, watching: true };
  }
}

export async function getWatchlist() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const snap = await db.collection('watchlist')
    .where('userId', '==', session.user.id)
    .orderBy('createdAt', 'desc')
    .get();

  return Promise.all(snap.docs.map(async d => {
    const w       = d.data();
    const aSnap   = await db.collection('auctions').doc(w.auctionId).get();
    return { ...w, id: d.id, auction: aSnap.exists ? { ...aSnap.data(), id: aSnap.id } : null };
  }));
}
