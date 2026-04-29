'use server';

import { db, docData, snapDocs } from '@/lib/db';
import { Dispute, EscrowTransaction, Auction, User } from '@/types';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { recalculateUserReputation } from '@/lib/reputation';

import { requireAdmin, isAdminEmail } from '@/lib/admin-guard';
import { log } from '@/lib/logger';

export async function raiseDispute(transactionId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const txSnap = await db.collection('escrowTransactions').doc(transactionId).get();
  if (!txSnap.exists) return { success: false, error: 'Transaction not found' };
  const tx = txSnap.data()!;

  if (tx.buyerId !== session.user.id) return { success: false, error: 'Unauthorized' };
  if (tx.status !== 'HELD')           return { success: false, error: 'Dispute only valid for held escrow.' };

  const existingSnap = await db.collection('disputes')
    .where('transactionId', '==', transactionId)
    .limit(1).get();
  if (!existingSnap.empty) return { success: false, error: 'Dispute already exists.' };

  const disputeId = db.collection('disputes').doc().id;
  const now       = new Date();

  const batch = db.batch();
  batch.set(db.collection('disputes').doc(disputeId), {
    id: disputeId, transactionId, openerId: session.user.id,
    reason, status: 'OPEN', resolution: null, createdAt: now, updatedAt: now,
  });
  batch.update(db.collection('escrowTransactions').doc(transactionId), {
    status: 'DISPUTED', updatedAt: now,
  });
  await batch.commit();

  revalidatePath('/dashboard/escrow');
  return { success: true };
}

export async function resolveDispute(disputeId: string, ruling: 'SELLER' | 'BUYER', resolution: string) {
  await requireAdmin();

  const disputeSnap = await db.collection('disputes').doc(disputeId).get();
  if (!disputeSnap.exists) return { success: false, error: 'Dispute not found' };
  const dispute = disputeSnap.data()!;
  if (dispute.status !== 'OPEN') return { success: false, error: 'Dispute already resolved' };

  const txSnap   = await db.collection('escrowTransactions').doc(dispute.transactionId).get();
  const tx       = txSnap.data()!;
  const aSnap    = await db.collection('auctions').doc(tx.auctionId).get();
  const sellerId = aSnap.data()?.sellerId;

  const finalEscrow  = ruling === 'SELLER' ? 'RELEASED' : 'REFUNDED';
  const finalDispute = ruling === 'SELLER' ? 'RESOLVED_SELLER' : 'RESOLVED_BUYER';
  const now          = new Date();

  const batch = db.batch();
  batch.update(db.collection('escrowTransactions').doc(dispute.transactionId), {
    status: finalEscrow, updatedAt: now,
  });
  batch.update(db.collection('disputes').doc(disputeId), {
    status: finalDispute, resolution, updatedAt: now,
  });
  await batch.commit();

  if (sellerId) await recalculateUserReputation(sellerId);
  await recalculateUserReputation(tx.buyerId);

  revalidatePath('/admin/disputes');
  revalidatePath('/dashboard/escrow');
  return { success: true };
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
