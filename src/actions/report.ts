'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { reportAuctionSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';

export async function reportAuction(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  const parsed = reportAuctionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const { auctionId, reason, description } = parsed.data;

  // Composite doc ID is idempotent — one user can have at most one report per
  // auction. This eliminates the pre-write collection query + TOCTOU race that
  // the previous implementation had.
  const reportId = `${auctionId}_${session.user.id}`;
  const reportRef = db.collection('reports').doc(reportId);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reportRef);
      if (snap.exists) throw new Error('You have already reported this auction.');

      const now = new Date();
      tx.set(reportRef, {
        id: reportId, auctionId, reporterId: session.user.id,
        reason, description: description ?? null,
        status: 'PENDING', createdAt: now, updatedAt: now,
      });
    });

    return { success: true };
  } catch (e) {
    log.error('[report] reportAuction failed', e);
    return { success: false, error: e instanceof Error ? e.message : 'Failed to submit report.' };
  }
}
