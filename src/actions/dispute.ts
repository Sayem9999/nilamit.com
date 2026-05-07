'use server';

import { db, FieldValue, docData, snapDocs } from '@/lib/db';
import { Dispute, EscrowTransaction, Auction, User } from '@/types';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { recalculateUserRating } from '@/lib/rating';
import { requireAdmin } from '@/lib/admin-guard';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { log } from '@/lib/logger';
import { raiseDisputeSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

const REFUNDABLE_ESCROW_STATES = new Set(['HELD', 'DISPUTED', 'PENDING', 'VERIFICATION_PENDING']);

export async function raiseDispute(transactionId: string, reason: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const parsed = raiseDisputeSchema.safeParse({ transactionId, reason });
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const disputeRef = db.collection('disputes').doc(transactionId);
  const escrowRef  = db.collection('escrowTransactions').doc(transactionId);

  try {
    await db.runTransaction(async (tx) => {
      const [escrowSnap, disputeSnap] = await Promise.all([
        tx.get(escrowRef),
        tx.get(disputeRef),
      ]);

      if (!escrowSnap.exists) throw new Error('Transaction not found');
      const escrow = escrowSnap.data()!;
      if (escrow.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (escrow.status !== 'HELD')           throw new Error('Dispute only valid for held escrow.');
      if (disputeSnap.exists)                 throw new Error('Dispute already exists.');

      const now = new Date();
      tx.set(disputeRef, {
        id: transactionId, transactionId, openerId: session.user.id,
        reason: parsed.data.reason, status: 'OPEN', resolution: null, createdAt: now, updatedAt: now,
      });
      tx.update(escrowRef, { status: 'DISPUTED', updatedAt: now });
    });

    revalidatePath('/dashboard/escrow');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] raiseDispute failed', e, { area: 'dispute', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to raise dispute.');
  }
}

export async function resolveDispute(disputeId: string, ruling: 'SELLER' | 'BUYER', resolution: string): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();

  const trimmedResolution = resolution?.trim();
  if (!trimmedResolution) return errorResponse(ErrorType.VALIDATION, 'Resolution notes are required.');
  if (trimmedResolution.length > 2000) return errorResponse(ErrorType.VALIDATION, 'Resolution notes too long.');

  try {
    const { sellerId, buyerId } = await db.runTransaction(async (tx) => {
      const disputeRef = db.collection('disputes').doc(disputeId);
      const disputeSnap = await tx.get(disputeRef);
      if (!disputeSnap.exists) throw new Error('Dispute not found');
      const dispute = disputeSnap.data()!;
      if (dispute.status !== 'OPEN') throw new Error('Dispute already resolved');

      const escrowRef  = db.collection('escrowTransactions').doc(dispute.transactionId);
      const escrowSnap = await tx.get(escrowRef);
      if (!escrowSnap.exists) throw new Error('Escrow not found for dispute');
      const escrow = escrowSnap.data()!;

      // Guard against an admin-initiated refund/release racing the dispute resolution.
      if (escrow.status !== 'DISPUTED') {
        throw new Error(`Cannot resolve: escrow is in ${escrow.status} state, not DISPUTED.`);
      }

      const aRef  = db.collection('auctions').doc(escrow.auctionId);
      const aSnap = await tx.get(aRef);
      const seller = (aSnap.data()?.sellerId as string | undefined) ?? null;

      const now          = new Date();
      const finalEscrow  = ruling === 'SELLER' ? 'RELEASED' : 'REFUNDED';
      const finalDispute = ruling === 'SELLER' ? 'RESOLVED_SELLER' : 'RESOLVED_BUYER';

      tx.update(escrowRef,  { status: finalEscrow,  updatedAt: now });
      tx.update(disputeRef, { status: finalDispute, resolution: trimmedResolution, updatedAt: now });

      // Refund mirrors the seller-side accounting from refundEscrow so reputation
      // stays consistent regardless of which path closes the transaction.
      if (ruling === 'BUYER' && seller) {
        tx.update(db.collection('users').doc(seller), {
          defectCount: FieldValue.increment(1),
          updatedAt: now,
        });
      }

      return { sellerId: seller, buyerId: escrow.buyerId as string };
    });

    await db.collection('admin_logs').add({
      action:    'RESOLVE_DISPUTE',
      adminId:   adminSession.user.id,
      targetId:  disputeId,
      ruling,
      resolution: trimmedResolution,
      createdAt: new Date(),
    });

    if (sellerId) {
      await Promise.all([
        recalculateUserRating(sellerId),
        ruling === 'BUYER' ? updateSellerPerformance(sellerId) : Promise.resolve(),
      ]);
    }
    await recalculateUserRating(buyerId);

    revalidatePath('/admin/disputes');
    revalidatePath('/dashboard/escrow');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] resolveDispute failed', e, { area: 'dispute', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Resolution failed.');
  }
}

/**
 * Admin override refund — single source of truth for refunds.
 * Validates current escrow state, cancels the linked auction, increments
 * seller defectCount, audit-logs with reason, and updates seller performance.
 */
export async function adminRefundEscrow(transactionId: string, reason: string): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();

  const trimmedReason = reason?.trim();
  if (!trimmedReason) return errorResponse(ErrorType.VALIDATION, 'A reason is required for admin refunds.');
  if (trimmedReason.length > 2000) return errorResponse(ErrorType.VALIDATION, 'Reason too long.');

  let sellerId: string | null = null;

  try {
    sellerId = await db.runTransaction(async (tx) => {
      const escrowRef  = db.collection('escrowTransactions').doc(transactionId);
      const escrowSnap = await tx.get(escrowRef);
      if (!escrowSnap.exists) throw new Error('Escrow transaction not found');
      const escrow = escrowSnap.data()!;

      if (!REFUNDABLE_ESCROW_STATES.has(escrow.status)) {
        throw new Error(`Cannot refund escrow in status: ${escrow.status}`);
      }

      const now = new Date();
      tx.update(escrowRef, { status: 'REFUNDED', updatedAt: now });

      let seller: string | null = null;
      if (escrow.auctionId) {
        const aRef  = db.collection('auctions').doc(escrow.auctionId);
        const aSnap = await tx.get(aRef);
        seller = (aSnap.data()?.sellerId as string | undefined) ?? null;

        tx.update(aRef, { status: 'CANCELLED', updatedAt: now });

        if (seller) {
          tx.update(db.collection('users').doc(seller), {
            defectCount: FieldValue.increment(1),
            updatedAt: now,
          });
        }
      }

      return seller;
    });

    await db.collection('admin_logs').add({
      action:    'ADMIN_REFUND_ESCROW',
      adminId:   adminSession.user.id,
      targetId:  transactionId,
      reason:    trimmedReason,
      createdAt: new Date(),
    });

    if (sellerId) await updateSellerPerformance(sellerId);

    log.info(`[Admin] Transaction ${transactionId} refunded by ${adminSession.user.id}`);
    revalidatePath('/admin/escrow');
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] adminRefundEscrow failed', e, { area: 'escrow', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Refund failed.');
  }
}

export async function getOpenDisputes(): Promise<ServiceResponse<unknown[]>> {
  try {
    await requireAdmin();
  } catch {
    return errorResponse(ErrorType.FORBIDDEN, 'Admin access required');
  }

  const snap = await db.collection('disputes').where('status', '==', 'OPEN').orderBy('createdAt', 'desc').get();
  if (snap.empty) return successResponse([]);

  const disputes = snapDocs<Dispute>(snap);

  const txIds     = [...new Set(disputes.map((d) => d.transactionId))];
  const openerIds = [...new Set(disputes.map((d) => d.openerId))];

  const [txSnaps, openerSnaps] = await Promise.all([
    db.getAll(...txIds.map((id) => db.collection('escrowTransactions').doc(id))),
    db.getAll(...openerIds.map((id) => db.collection('users').doc(id))),
  ]);

  const txMap     = new Map(txSnaps.map((s) => [s.id, docData<EscrowTransaction>(s)]));
  const openerMap = new Map(openerSnaps.map((s) => [s.id, docData<User>(s)]));

  const auctionIds = [...new Set(txSnaps.map((s) => (s.data() ?? {}).auctionId as string).filter(Boolean))];
  const buyerIds   = [...new Set(txSnaps.map((s) => (s.data() ?? {}).buyerId   as string).filter(Boolean))];

  const [auctionSnaps, buyerSnaps] = await Promise.all([
    auctionIds.length ? db.getAll(...auctionIds.map((id) => db.collection('auctions').doc(id))) : Promise.resolve([]),
    buyerIds.length   ? db.getAll(...buyerIds.map((id)   => db.collection('users').doc(id)))    : Promise.resolve([]),
  ]);

  const auctionMap = new Map(auctionSnaps.map((s) => [s.id, docData<Auction>(s)]));
  const buyerMap   = new Map(buyerSnaps.map((s) => [s.id, docData<User>(s)]));

  const sellerIds = [...new Set(
    auctionSnaps.map((s) => (s.data() ?? {}).sellerId as string).filter(Boolean),
  )];
  const sellerMap = new Map<string, User | null>();
  if (sellerIds.length > 0) {
    const sellerSnaps = await db.getAll(...sellerIds.map((id) => db.collection('users').doc(id)));
    sellerSnaps.forEach((s) => sellerMap.set(s.id, docData<User>(s)));
  }

  return successResponse(disputes.map((dispute) => {
    const tx     = txMap.get(dispute.transactionId);
    const opener = openerMap.get(dispute.openerId);
    const a      = tx ? auctionMap.get(tx.auctionId)   : null;
    const buyer  = tx ? buyerMap.get(tx.buyerId)        : null;
    const seller = a?.sellerId ? (sellerMap.get(a.sellerId) ?? null) : null;

    return {
      ...dispute,
      transaction: {
        id:        tx?.id        ?? '',
        amount:    tx?.amount    ?? 0,
        auctionId: tx?.auctionId ?? '',
        auction: { title: a?.title ?? '', seller: { name: seller?.name ?? null } },
        buyer:   { name: buyer?.name ?? null, email: buyer?.email ?? null },
      },
      opener: { name: opener?.name ?? null, email: opener?.email ?? null },
    };
  }));
}
