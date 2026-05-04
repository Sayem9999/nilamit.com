"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/logger";
import { ErrorType, errorResponse, successResponse, ServiceResponse } from "@/lib/errors";

export async function isWatched(auctionId: string): Promise<ServiceResponse<boolean>> {
  const session = await auth();
  if (!session?.user?.id) return successResponse(false);
  try {
    const snap = await db.collection('watchlist').doc(`${session.user.id}_${auctionId}`).get();
    return successResponse(snap.exists);
  } catch (_e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to check watchlist status');
  }
}

export async function toggleWatchlist(auctionId: string): Promise<ServiceResponse<{ watching: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
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
  } catch (e) {
    log.error('toggleWatchlist failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to update watchlist');
  }
}

export async function getWatchlist(): Promise<ServiceResponse<unknown[]>> {
  const session = await auth();
  if (!session?.user?.id) return successResponse([]);

  try {
    const snap = await db.collection('watchlist')
      .where('userId', '==', session.user.id)
      .orderBy('createdAt', 'desc')
      .get();

    if (snap.empty) return successResponse([]);

    // Batch-fetch all referenced auctions in one round-trip instead of N+1
    const auctionIds = [...new Set(snap.docs.map(d => d.data().auctionId as string))];
    const aSnaps     = await db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id)));
    const aMap       = new Map(aSnaps.map(s => [s.id, s.exists ? { ...s.data(), id: s.id } : null]));

    const result = snap.docs.map(d => {
      const w = d.data();
      return { ...w, id: d.id, auction: aMap.get(w.auctionId) ?? null };
    });

    return successResponse(result);
  } catch (e) {
    log.error('getWatchlist failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch watchlist');
  }
}
