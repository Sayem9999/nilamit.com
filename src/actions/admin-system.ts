'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
}

function readDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
    return { success: true, message: 'All auction data wiped successfully.' };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Wipe Error:', err);
    return { success: false, error: 'Failed to wipe data: ' + err.message };
  }
}

export async function exportTransactionsCSV() {
  try {
    await requireAdmin();

    const soldSnap = await db.collection('auctions')
      .where('status', '==', 'SOLD')
      .get();

    const auctions = soldSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
        updatedAt: readDate(doc.data().updatedAt),
      }))
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));

    const userIds = new Set<string>();
    auctions.forEach((auction: any) => {
      if (typeof auction.winnerId === 'string' && auction.winnerId) userIds.add(auction.winnerId);
      if (typeof auction.sellerId === 'string' && auction.sellerId) userIds.add(auction.sellerId);
    });

    const userSnaps = await Promise.all([...userIds].map((userId) => db.collection('users').doc(userId).get()));
    const users = new Map(
      userSnaps
        .filter((snap) => snap.exists)
        .map((snap) => [snap.id, snap.data() as Record<string, unknown>])
    );

    let csv = 'Auction ID,Title,Final Price,Winner Name,Winner Phone,Commission (à§³),Date\n';

    for (const auction of auctions as any[]) {
      const winner = typeof auction.winnerId === 'string' ? users.get(auction.winnerId) : null;
      const seller = typeof auction.sellerId === 'string' ? users.get(auction.sellerId) : null;
      const commission = Number(auction.commissionEarned ?? Number(auction.currentPrice ?? 0) * 0.1);
      const updatedAt = auction.updatedAt ?? new Date();

      const row = [
        auction.id,
        csvEscape(auction.title),
        auction.currentPrice,
        csvEscape(winner?.name ?? 'Unknown'),
        csvEscape(winner?.phone ?? seller?.phone ?? 'N/A'),
        commission.toFixed(2),
        updatedAt.toISOString().split('T')[0],
      ];

      csv += row.join(',') + '\n';
    }

    return { success: true, data: csv };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('CSV Export Error:', err);
    return { success: false, error: 'Failed to generate CSV: ' + err.message };
  }
}
