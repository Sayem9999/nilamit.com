'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { recalculateUserRating } from '@/lib/rating';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { batchHydrateEscrowRows, type AdminEscrowDoc } from './shared';

/**
 * All escrow transactions in DISPUTED state, with attached dispute reason.
 * UI: src/app/[locale]/admin/tabs/DisputesTab.tsx
 */
export async function getAdminDisputes(): Promise<ServiceResponse<unknown[]>> {
  try {
    await requireAdmin();

    const txSnap = await db.collection('escrowTransactions')
      .where('status', '==', 'DISPUTED')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

    const [hydratedRows, disputeSnaps] = await Promise.all([
      batchHydrateEscrowRows(txDocs),
      txDocs.length > 0 
        ? db.getAll(...txDocs.map(tx => db.collection('disputes').doc(tx.id)))
        : Promise.resolve([])
    ]);

    const disputeMap = new Map(disputeSnaps.filter(s => s.exists).map(s => [s.id, s.data()]));

    const data = hydratedRows.map((row) => {
      const d = disputeMap.get(row.id);
      return {
        ...row,
        dispute: d ? { reason: (d.reason as string) ?? '' } : null,
      };
    });
    return successResponse(data);
  } catch (_e) {
    log.error('[admin] getAdminDisputes failed', _e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch disputes');
  }
}

/**
 * Force-resolve a held/disputed escrow.
 */
export async function resolveAdminDispute(transactionId: string, resolution: 'RELEASE' | 'REFUND' | 'HOLD'): Promise<ServiceResponse<null>> {
  try {
    await requireAdmin();

    const result = await db.runTransaction(async (tx) => {
      const txRef = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (!['HELD', 'DISPUTED'].includes(t.status)) {
        throw new Error(`Cannot resolve escrow in ${t.status} state`);
      }

      let finalEscrow = t.status;
      if (resolution === 'RELEASE') finalEscrow = 'RELEASED';
      else if (resolution === 'REFUND') finalEscrow = 'REFUNDED';
      else if (resolution === 'HOLD') finalEscrow = 'HELD';

      const now = new Date();
      tx.update(txRef, { status: finalEscrow, updatedAt: now });

      const aSnap = await tx.get(db.collection('auctions').doc(t.auctionId));
      const sellerId = aSnap.data()?.sellerId ?? null;

      const disputeQuery = db.collection('disputes')
        .where('transactionId', '==', transactionId)
        .where('status', '==', 'OPEN')
        .limit(1);
      const disputeSnap = await tx.get(disputeQuery);

      if (!disputeSnap.empty) {
        const dRef = disputeSnap.docs[0].ref;
        let disputeStatus = 'OPEN';
        if (resolution === 'RELEASE') disputeStatus = 'RESOLVED_SELLER';
        else if (resolution === 'REFUND') disputeStatus = 'RESOLVED_BUYER';
        else if (resolution === 'HOLD') disputeStatus = 'UNDER_INVESTIGATION';

        tx.update(dRef, {
          status: disputeStatus,
          resolution: `Admin override: ${resolution}`,
          updatedAt: now,
        });
      }

      if (resolution === 'REFUND') {
        tx.update(db.collection('auctions').doc(t.auctionId), { status: 'CANCELLED', updatedAt: now });
      }

      return { sellerId, buyerId: t.buyerId };
    });

    if (resolution !== 'HOLD') {
      if (result.sellerId) await recalculateUserRating(result.sellerId);
      await recalculateUserRating(result.buyerId);
    }

    revalidatePath('/admin');
    return successResponse(null);
  } catch (_e) {
    log.error('[admin] resolveAdminDispute failed', _e, { transactionId, resolution });
    return errorResponse(ErrorType.INTERNAL, _e instanceof Error ? _e.message : 'Resolution failed');
  }
}

/**
 * Read the buyer/seller coordination chat for an auction (admin view).
 */
export async function getAdminCoordinationLog(auctionId: string): Promise<ServiceResponse<unknown[]>> {
  try {
    await requireAdmin();

    const messagesSnap = await db.collection('messages')
      .where('conversationId', '==', auctionId)
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();

    const data = messagesSnap.docs.map((d) => {
      const data = d.data();
      const createdAtRaw = data.createdAt as { toDate?: () => Date } | Date;
      const createdAt = createdAtRaw instanceof Date ? createdAtRaw : createdAtRaw?.toDate?.() ?? new Date();
      return {
        id: d.id,
        content: (data.content as string) ?? '',
        senderId: (data.senderId as string) ?? 'system',
        isSystemMessage: Boolean(data.isSystemMessage),
        createdAt,
        imageUrl: (data.imageUrl as string | null) ?? null,
      };
    });
    return successResponse(data);
  } catch (_e) {
    log.error('[admin] getAdminCoordinationLog failed', _e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch coordination log');
  }
}
