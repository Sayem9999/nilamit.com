'use server';

import { db, snapDocs } from '@/lib/db';
import { Auction } from '@/types';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

async function deleteCollection(name: string, batchSize = 100) {
  while (true) {
    const snap = await db.collection(name).limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    if (snap.size < batchSize) break;
  }
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export async function adminWipeTestData() {
  try {
    await requireAdmin();

    await Promise.all([
      deleteCollection('messages'),
      deleteCollection('conversations'),
      deleteCollection('escrowTransactions'),
      deleteCollection('disputes'),
      deleteCollection('bids'),
      deleteCollection('watchlist'),
      deleteCollection('alerts'),
      deleteCollection('reports'),
      deleteCollection('reviews'),
      deleteCollection('auctions'),
    ]);

    revalidatePath('/');
    return successResponse({ message: 'All auction data wiped successfully.' });
  } catch (error: unknown) {
    const err = error as Error;
    log.error('[admin-system] Wipe Error', err);
    return errorResponse(ErrorType.INTERNAL, 'Failed to wipe data: ' + err.message);
  }
}

export async function exportTransactionsCSV() {
  try {
    await requireAdmin();

    const soldSnap = await db.collection('auctions')
      .where('status', '==', 'SOLD')
      .get();

    const auctions = snapDocs<Auction>(soldSnap)
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));

    const userIds = new Set<string>();
    auctions.forEach((auction) => {
      if (auction.winnerId) userIds.add(auction.winnerId);
      if (auction.sellerId) userIds.add(auction.sellerId);
    });

    const userSnaps = await Promise.all([...userIds].map((userId) => db.collection('users').doc(userId).get()));
    const users = new Map(
      userSnaps
        .filter((snap) => snap.exists)
        .map((snap) => [snap.id, snap.data() as Record<string, unknown>])
    );

    let csv = 'Auction ID,Title,Final Price,Winner Name,Winner Email,Commission (৳),Date\n';

    for (const auction of auctions) {
      const winner = typeof auction.winnerId === 'string' ? users.get(auction.winnerId) : null;
      const commission = Number(auction.commissionEarned ?? Number(auction.currentPrice ?? 0) * 0.1);
      const updatedAt = auction.updatedAt ?? new Date();

      const row = [
        auction.id,
        csvEscape(auction.title),
        auction.currentPrice,
        csvEscape(winner?.name ?? 'Unknown'),
        csvEscape(winner?.email ?? 'N/A'),
        commission.toFixed(2),
        updatedAt.toISOString().split('T')[0],
      ];

      csv += row.join(',') + '\n';
    }

    return successResponse({ data: csv });
  } catch (error: unknown) {
    const err = error as Error;
    log.error('[admin-system] CSV Export Error', err);
    return errorResponse(ErrorType.INTERNAL, 'Failed to generate CSV: ' + err.message);
  }
}
