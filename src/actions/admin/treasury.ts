'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { batchHydrateEscrowRows, type AdminEscrowDoc } from './shared';
import { recordLedgerEntry } from '@/lib/ledger';
import { AuditService } from '@/services/admin/audit-service';
import { AggregateField } from 'firebase-admin/firestore';

/**
 * Recent automated escrow transactions for the treasury audit table.
 * Filters to states where money has actually moved (HELD / RELEASED).
 */
export async function getTreasuryAudit(): Promise<ServiceResponse<unknown[]>> {
  try {
    await requireAdmin();

    const txSnap = await db.collection('escrowTransactions')
      .where('status', 'in', ['HELD', 'RELEASED', 'VERIFICATION_PENDING'])
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

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
  try {
    await requireAdmin();

    const txSnap = await db.collection('escrowTransactions')
      .where('status', '==', 'HELD')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

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
  try {
    await requireAdmin();

    const txSnap = await db.collection('escrowTransactions')
      .where('status', '==', 'VERIFICATION_PENDING')
      .orderBy('createdAt', 'desc')
      .get();

    const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

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
  try {
    const admin = await requireAdmin();

    const escrow = await db.runTransaction(async (tx) => {
      const ref = db.collection('escrowTransactions').doc(transactionId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Transaction not found');
      const data = snap.data()!;
      if (data.status !== 'VERIFICATION_PENDING') throw new Error('Transaction not in pending state');

      const update = { status: 'HELD', updatedAt: new Date(), verifiedBy: admin.user.id };
      tx.update(ref, update);
      // Audit-log this transition (previously missing for the approve path).
      await AuditService.logEscrowChange(transactionId, { ...data }, { ...data, ...update }, 'UPDATE', admin.user.id, tx);
      return data;
    });

    // Ledger: payment verified — funds now held in escrow (money IN).
    await recordLedgerEntry({
      type: 'ADVANCE_HELD',
      direction: 'IN',
      escrowId: transactionId,
      auctionId: escrow.auctionId as string,
      amount: (escrow.amount as number) ?? 0,
      buyerId: escrow.buyerId as string,
      sellerId: escrow.sellerId as string,
      paymentMethod: (escrow.paymentMethod as string) ?? 'mfs_manual',
      providerRef: (escrow.providerRef as string) ?? null,
      operatorId: admin.user.id,
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
  try {
    const admin = await requireAdmin();

    const { CommitmentService } = await import('@/services/finance/commitment-service');
    return await CommitmentService.refundWithLogisticsDeduction(transactionId, admin.user.id);
  } catch (e) {
    log.error('[admin] refundWithDeduction failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to process deduction-based refund');
  }
}

export interface LedgerSummary {
  totalIn: number;       // funds confirmed into escrow
  totalOut: number;      // funds released to sellers
  totalRefund: number;   // funds refunded to buyers
  heldBalance: number;   // IN − OUT − REFUND ≈ money currently held in escrow
  counts: { in: number; out: number; refund: number };
}

/**
 * Reconciliation summary over the financial ledger. Server-side aggregation
 * (sum/count) so it scales without reading every entry. heldBalance should
 * reconcile against the sum of HELD escrowTransactions.
 */
export async function getLedgerSummary(): Promise<ServiceResponse<LedgerSummary>> {
  try {
    await requireAdmin();
    const col = db.collection('ledgerEntries');
    const spec = { amount: AggregateField.sum('amount'), count: AggregateField.count() };

    const [inAgg, outAgg, refundAgg] = await Promise.all([
      col.where('direction', '==', 'IN').aggregate(spec).get(),
      col.where('direction', '==', 'OUT').aggregate(spec).get(),
      col.where('direction', '==', 'REFUND').aggregate(spec).get(),
    ]);

    const totalIn = (inAgg.data().amount as number) ?? 0;
    const totalOut = (outAgg.data().amount as number) ?? 0;
    const totalRefund = (refundAgg.data().amount as number) ?? 0;

    return successResponse({
      totalIn,
      totalOut,
      totalRefund,
      heldBalance: totalIn - totalOut - totalRefund,
      counts: {
        in: (inAgg.data().count as number) ?? 0,
        out: (outAgg.data().count as number) ?? 0,
        refund: (refundAgg.data().count as number) ?? 0,
      },
    });
  } catch (e) {
    log.error('[admin] getLedgerSummary failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to load ledger summary');
  }
}

/** Most recent ledger entries for the treasury feed. */
export async function getRecentLedger(): Promise<ServiceResponse<unknown[]>> {
  try {
    await requireAdmin();
    const snap = await db.collection('ledgerEntries').orderBy('createdAt', 'desc').limit(50).get();
    const rows = snap.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        ...x,
        id: d.id,
        createdAt: (x.createdAt as { toDate?: () => Date })?.toDate?.() ?? null,
      };
    });
    return successResponse(rows);
  } catch (e) {
    log.error('[admin] getRecentLedger failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to load ledger');
  }
}
