'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { recalculateUserReputation } from '@/lib/reputation';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}

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
  console.log(`[Admin] Transaction ${transactionId} refunded. Reason: ${reason}`);
  revalidatePath('/admin/escrow');
  return { success: true };
}

export async function getOpenDisputes() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return [];

  const snap = await db.collection('disputes').where('status', '==', 'OPEN').orderBy('createdAt', 'desc').get();

  return Promise.all(snap.docs.map(async d => {
    const dispute = { ...d.data(), id: d.id } as { id: string; transactionId: string; openerId: string; [key: string]: any };
    const [txSnap, openerSnap] = await Promise.all([
      db.collection('escrowTransactions').doc(dispute.transactionId).get(),
      db.collection('users').doc(dispute.openerId).get(),
    ]);
    const tx     = txSnap.data() ?? {};
    const opener = openerSnap.data() ?? {};
    const aSnap  = await db.collection('auctions').doc(tx.auctionId).get();
    const buyer  = await db.collection('users').doc(tx.buyerId ?? '').get();
    const a      = aSnap.data() ?? {};
    const seller = await db.collection('users').doc(a.sellerId ?? '').get();
    return {
      ...dispute,
      transaction: {
        ...tx, id: txSnap.id,
        auction: { title: a.title ?? '', seller: { name: seller.data()?.name ?? '' } },
        buyer:   { name: buyer.data()?.name ?? '', email: buyer.data()?.email ?? '' },
      },
      opener: { name: opener.name ?? '', email: opener.email ?? '' },
    };
  }));
}
