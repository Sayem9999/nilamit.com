'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

export async function reportAuction(data: { auctionId: string; reason: string; description?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  const ref = db.collection('reports').doc();
  const now = new Date();
  await ref.set({
    id: ref.id, auctionId: data.auctionId, reporterId: session.user.id,
    reason: data.reason, description: data.description ?? null,
    status: 'PENDING', createdAt: now, updatedAt: now,
  });

  return { success: true };
}

export async function getReports(status?: string) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return [];

  let query: FirebaseFirestore.Query = db.collection('reports').orderBy('createdAt', 'desc');
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();
  return snap.docs.map(d => ({
    ...d.data(), id: d.id,
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt),
  }));
}
