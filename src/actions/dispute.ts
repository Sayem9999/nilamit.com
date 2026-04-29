'use server';

import { db, docData, snapDocs } from '@/lib/db';
import { Dispute, EscrowTransaction, Auction, User } from '@/types';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { recalculateUserReputation } from '@/lib/reputation';

import { requireAdmin, isAdminEmail } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { raiseDisputeSchema, formatZodError } from '@/lib/schemas';

export async function raiseDispute(transactionId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const parsed = raiseDisputeSchema.safeParse({ transactionId, reason });
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  // Use transactionId as the dispute doc ID — idempotent: two concurrent calls
  // result in one successful tx.set and one "already exists" error, not two disputes.
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
    return { success: true };
  } catch (e) {
    log.error('[dispute] raiseDispute failed', e);
    return { success: false, error: e instanceof Error ? e.message : 'Failed to raise dispute.' };
  }
}

export async function resolveDispute(disputeId: string, ruling: 'SELLER' | 'BUYER', resolution: string) {
  await requireAdmin();

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

      const aRef   = db.collection('auctions').doc(escrow.auctionId);
      const aSnap  = await tx.get(aRef);
      const seller = (aSnap.data()?.sellerId as string | undefined) ?? null;

      const now          = new Date();
      const finalEscrow  = ruling === 'SELLER' ? 'RELEASED' : 'REFUNDED';
      const finalDispute = ruling === 'SELLER' ? 'RESOLVED_SELLER' : 'RESOLVED_BUYER';

      tx.update(escrowRef,  { status: finalEscrow,  updatedAt: now });
      tx.update(disputeRef, { status: finalDispute, resolution, updatedAt: now });

      return { sellerId: seller, buyerId: escrow.buyerId as string };
    });

    if (sellerId) await recalculateUserReputation(sellerId);
    await recalculateUserReputation(buyerId);

    revalidatePath('/admin/disputes');
    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (e) {
    log.error('[dispute] resolveDispute failed', e);
    return { success: false, error: e instanceof Error ? e.message : 'Resolution failed.' };
  }
}

/** Admin override refund — uses runtime ADMIN_EMAILS check, not token flag */
export async function adminRefundEscrow(transactionId: string, reason: string) {
  await requireAdmin();

  await db.collection('escrowTransactions').doc(transactionId).update({
    status: 'REFUNDED', updatedAt: new Date(),
  });
  log.info(`[Admin] Transaction ${transactionId} refunded. Reason: ${reason}`);
  revalidatePath('/admin/escrow');
  return { success: true };
}

export async function getOpenDisputes() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) return [];

  const snap = await db.collection('disputes').where('status', '==', 'OPEN').orderBy('createdAt', 'desc').get();
  if (snap.empty) return [];

  const disputes = snapDocs<Dispute>(snap);

  // Pass 1 — transactions + openers (both available directly from dispute docs)
  const txIds     = [...new Set(disputes.map((d) => d.transactionId))];
  const openerIds = [...new Set(disputes.map((d) => d.openerId))];

  const [txSnaps, openerSnaps] = await Promise.all([
    db.getAll(...txIds.map((id) => db.collection('escrowTransactions').doc(id))),
    db.getAll(...openerIds.map((id) => db.collection('users').doc(id))),
  ]);

  const txMap     = new Map(txSnaps.map((s) => [s.id, docData<EscrowTransaction>(s)]));
  const openerMap = new Map(openerSnaps.map((s) => [s.id, docData<User>(s)]));

  // Pass 2 — auctions + buyers (IDs come from the transaction docs)
  const auctionIds = [...new Set(txSnaps.map((s) => (s.data() ?? {}).auctionId as string).filter(Boolean))];
  const buyerIds   = [...new Set(txSnaps.map((s) => (s.data() ?? {}).buyerId   as string).filter(Boolean))];

  const [auctionSnaps, buyerSnaps] = await Promise.all([
    auctionIds.length ? db.getAll(...auctionIds.map((id) => db.collection('auctions').doc(id))) : Promise.resolve([]),
    buyerIds.length   ? db.getAll(...buyerIds.map((id)   => db.collection('users').doc(id)))    : Promise.resolve([]),
  ]);

  const auctionMap = new Map(auctionSnaps.map((s) => [s.id, docData<Auction>(s)]));
  const buyerMap   = new Map(buyerSnaps.map((s) => [s.id, docData<User>(s)]));

  // Pass 3 — sellers (IDs come from the auction docs)
  const sellerIds = [...new Set(
    auctionSnaps.map((s) => (s.data() ?? {}).sellerId as string).filter(Boolean),
  )];

  const sellerMap = new Map<string, User | null>();
  if (sellerIds.length > 0) {
    const sellerSnaps = await db.getAll(...sellerIds.map((id) => db.collection('users').doc(id)));
    sellerSnaps.forEach((s) => sellerMap.set(s.id, docData<User>(s)));
  }

  return disputes.map((dispute) => {
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
  });
}
