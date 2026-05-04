'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { batchHydrateEscrowRows, type AdminEscrowDoc } from './shared';

/**
 * Recent automated escrow transactions for the treasury audit table.
 * Filters to states where money has actually moved (HELD / RELEASED).
 */
export async function getTreasuryAudit(): Promise<ServiceResponse<unknown[]>> {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', 'in', ['HELD', 'RELEASED', 'VERIFICATION_PENDING'])
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getTreasuryAudit failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to fetch treasury audit');
  }
}

/**
 * Currently HELD escrows — surfaced in TreasuryTab for admin manual override.
 */
export async function getAdminActiveEscrows(): Promise<ServiceResponse<unknown[]>> {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', '==', 'HELD')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getAdminActiveEscrows failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to fetch active escrows');
  }
}

/**
 * Transactions awaiting manual verification of MFS payments.
 */
export async function getVerificationQueue(): Promise<ServiceResponse<unknown[]>> {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', '==', 'VERIFICATION_PENDING')
    .orderBy('createdAt', 'desc')
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getVerificationQueue failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch verification queue');
  }
}

/**
 * Approve a pending MFS payment after manual verification.
 */
export async function approveEscrowPayment(transactionId: string): Promise<ServiceResponse<null>> {
  const admin = await requireAdmin();

  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection('escrowTransactions').doc(transactionId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Transaction not found');
      if (snap.data()?.status !== 'VERIFICATION_PENDING') throw new Error('Transaction not in pending state');

      tx.update(ref, {
        status: 'HELD',
        updatedAt: new Date(),
        verifiedBy: admin.user.id
      });
    });

    log.info(`[Admin] Payment ${transactionId} approved by ${admin.user.id}`);
    return successResponse(null);
  } catch (e) {
    log.error('[admin] approveEscrowPayment failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to approve payment');
  }
}

/**
 * Force a refund to the buyer but deduct a standard logistics fee (120 BDT) for the seller.
 */
export async function refundWithDeduction(transactionId: string): Promise<ServiceResponse<null>> {
  const admin = await requireAdmin();

  try {
    const { CommitmentService } = await import('@/services/finance/commitment-service');
    return await CommitmentService.refundWithLogisticsDeduction(transactionId, admin.user.id);
  } catch (e) {
    log.error('[admin] refundWithDeduction failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to process deduction-based refund');
  }
}
