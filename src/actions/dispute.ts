'use server';

import { db, docData, snapDocs } from '@/lib/db';
import { Dispute, EscrowTransaction, Auction, User } from '@/types';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { recalculateUserRating } from '@/lib/rating';
import { requireAdmin } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { raiseDisputeSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

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
        reason, status: 'OPEN', resolution: null, createdAt: now, updatedAt: now,
      });
      tx.update(escrowRef, { status: 'DISPUTED', updatedAt: now });
    });

    revalidatePath('/dashboard/escrow');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] raiseDispute failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to raise dispute.');
  }
}

export async function resolveDispute(disputeId: string, ruling: 'SELLER' | 'BUYER', resolution: string): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();

  try {
    const { sellerId, buyerId } = await db.runTransaction(async (tx) => {
      const disputeRef = db.collection('disputes').doc(disputeId);
      const disputeSnap = await tx.get(disputeRef);
      if (!disputeSnap.exists) throw new Error('Dispute not found');
      const dispute = disputeSnap.data()!;
      if (dispute.status !== 'OPEN') throw new Error('Dispute already resolved');

      const escrowRef  = db.collection('escrowTransactions').doc(dispute.transactionId);
      const escrowSnap = await tx.get(escrowRef);
      const escrow     = escrowSnap.data()!;

      const aRef  = db.collection('auctions').doc(escrow.auctionId);
      const aSnap = await tx.get(aRef);
      const seller = (aSnap.data()?.sellerId as string | undefined) ?? null;

      const now          = new Date();
      const finalEscrow  = ruling === 'SELLER' ? 'RELEASED' : 'REFUNDED';
      const finalDispute = ruling === 'SELLER' ? 'RESOLVED_SELLER' : 'RESOLVED_BUYER';

      tx.update(escrowRef,  { status: finalEscrow,  updatedAt: now });
      tx.update(disputeRef, { status: finalDispute, resolution, updatedAt: now });

      return { sellerId: seller, buyerId: escrow.buyerId as string };
    });

    await db.collection('admin_logs').add({
      action:    'RESOLVE_DISPUTE',
      adminId:   adminSession.user.id,
      targetId:  disputeId,
      ruling,
      createdAt: new Date(),
    });

    if (sellerId) await recalculateUserRating(sellerId);
    await recalculateUserRating(buyerId);

    revalidatePath('/admin/disputes');
    revalidatePath('/dashboard/escrow');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] resolveDispute failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Resolution failed.');
  }
}

/**
 * Admin override refund — always cancels the linked auction to keep state consistent.
 */
export async function adminRefundEscrow(transactionId: string, reason: string): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();

  try {
    await db.runTransaction(async (tx) => {
      const escrowRef  = db.collection('escrowTransactions').doc(transactionId);
      const escrowSnap = await tx.get(escrowRef);
      if (!escrowSnap.exists) throw new Error('Escrow transaction not found');
      const escrow = escrowSnap.data()!;

      const now = new Date();
      tx.update(escrowRef, { status: 'REFUNDED', updatedAt: now });

      // Cancel the auction so it doesn't remain SOLD with an unfulfilled winner
      if (escrow.auctionId) {
        tx.update(db.collection('auctions').doc(escrow.auctionId), {
          status: 'CANCELLED', updatedAt: now,
        });
      }
    });

    await db.collection('admin_logs').add({
      action:    'ADMIN_REFUND_ESCROW',
      adminId:   adminSession.user.id,
      targetId:  transactionId,
      reason,
      createdAt: new Date(),
    });

    log.info(`[Admin] Transaction ${transactionId} refunded. Reason: ${reason}`);
    revalidatePath('/admin/escrow');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] adminRefundEscrow failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Refund failed.');
  }
}

export async function getOpenDisputes(): Promise<ServiceResponse<unknown[]>> {
  try { 
    await requireAdmin(); 
  } catch (_e) { 
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
