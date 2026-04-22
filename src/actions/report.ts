'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';


export async function reportAuction(data: { auctionId: string; reason: string; description?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  // 1. Uniqueness Check: Prevent Spam
  const existingSnap = await db.collection('reports')
    .where('auctionId', '==', data.auctionId)
    .where('reporterId', '==', session.user.id)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return { success: false, error: 'You have already reported this auction.' };
  }

  const ref = db.collection('reports').doc();
  const now = new Date();
  await ref.set({
    id: ref.id, 
    auctionId: data.auctionId, 
    reporterId: session.user.id,
    reason: data.reason, 
    description: data.description ?? null,
    status: 'PENDING', 
    createdAt: now, 
    updatedAt: now,
  });

  return { success: true };
}
