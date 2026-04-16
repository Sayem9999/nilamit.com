'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { adminDB, rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recalculateUserReputation } from '@/lib/reputation';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * Transitions PENDING → HELD (buyer confirms advance payment).
 * Security: verifies caller is the transaction buyer before updating.
 */
export async function payEscrowAdvance(transactionId: string, providerRef?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const txSnap = await db.collection('escrowTransactions').doc(transactionId).get();
    if (!txSnap.exists) return { success: false, error: 'Transaction not found' };
    const tx = txSnap.data()!;

    // Authorization: only the buyer may pay
    if (tx.buyerId !== session.user.id) return { success: false, error: 'Unauthorized' };
    if (tx.status !== 'PENDING')        return { success: false, error: 'Advance already paid' };

    // MFS linkage enforcement
    const buyerSnap = await db.collection('users').doc(session.user.id).get();
    const buyer     = buyerSnap.data() ?? {};
    if (!buyer.bkashNumber && !buyer.nagadNumber) {
      return { success: false, error: 'MFS_LINKAGE_REQUIRED',
        message: 'Please link your bKash or Nagad account in settings.' };
    }

    const auctionSnap = await db.collection('auctions').doc(tx.auctionId).get();
    const auction     = auctionSnap.data() ?? {};

    const ref = providerRef ?? `SIM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    await db.collection('escrowTransactions').doc(transactionId).update({
      status:           'HELD',
      paymentMethod:    'bkash_automatic',
      providerRef:      ref,
      verificationType: 'AUTOMATIC',
      updatedAt:        new Date(),
    });

    // Open direct chat conversation
    const convId = tx.auctionId;
    const convRef = db.collection('conversations').doc(convId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      const now = new Date();
      await convRef.set({
        id: convId, auctionId: tx.auctionId, buyerId: tx.buyerId, sellerId: auction.sellerId,
        lastMessageAt: now, createdAt: now,
      });
      const msgId = db.collection('messages').doc().id;
      await db.collection('messages').doc(msgId).set({
        id: msgId, conversationId: convId, senderId: 'system',
        content: 'Advance paid! You can now coordinate delivery details here.',
        isSystemMessage: true, isRead: false, createdAt: now,
      });
    }
    await adminDB.ref(`${RTDB_PATHS.conversation(convId)}/meta`).update({
      auctionId: tx.auctionId,
      participants: {
        [tx.buyerId]: true,
        [auction.sellerId]: true,
      },
    });

    // Notify seller
    await rtdbPush(RTDB_PATHS.userNotifications(auction.sellerId), {
      event:        FIREBASE_EVENTS.ADVANCE_PAID,
      auctionId:    tx.auctionId,
      auctionTitle: auction.title,
      buyerName:    buyer.name ?? 'A buyer',
      message:      `Advance received for "${auction.title}". Delivery info is now unlocked.`,
    });

    revalidatePath('/dashboard');
    revalidatePath(`/auctions/${tx.auctionId}`);
    return { success: true };
  } catch (e) {
    console.error('[escrow] payEscrowAdvance failed:', e);
    return { success: false, error: 'Internal error during advance payment' };
  }
}

/**
 * Buyer confirms item received — releases escrow.
 */
export async function confirmItemReceived(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    await db.runTransaction(async (tx) => {
      const ref  = db.collection('escrowTransactions').doc(transactionId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Transaction not found');
      const t = snap.data()!;

      if (t.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (t.status !== 'HELD')           throw new Error('Not in a holdable state');

      tx.update(ref, { status: 'RELEASED', updatedAt: new Date() });

      const aRef  = db.collection('auctions').doc(t.auctionId);
      tx.update(aRef, { deliveryStatus: 'DELIVERED', updatedAt: new Date() });
    });

    // Fetch auction + escrow for reputation + notifications
    const txSnap = await db.collection('escrowTransactions').doc(transactionId).get();
    const txData = txSnap.data()!;
    const aSnap  = await db.collection('auctions').doc(txData.auctionId).get();
    const sellerId = aSnap.data()?.sellerId;

    if (sellerId) {
      await Promise.all([
        recalculateUserReputation(sellerId),
        recalculateUserReputation(session.user.id),
        rtdbPush(RTDB_PATHS.userNotifications(sellerId), {
          event: FIREBASE_EVENTS.TRUST_UPDATE, message: 'Reputation improved! Successful sale confirmed.', newStatus: 'RELEASED',
        }),
        rtdbPush(RTDB_PATHS.userNotifications(session.user.id), {
          event: FIREBASE_EVENTS.TRUST_UPDATE, message: 'Reputation improved! Successful purchase confirmed.', newStatus: 'RELEASED',
        }),
      ]);
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (e) {
    console.error('[escrow] confirmItemReceived failed:', e);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Refund escrow — SECURITY FIX: requires admin or buyer ownership.
 */
export async function refundEscrow(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const snap = await db.collection('escrowTransactions').doc(transactionId).get();
  if (!snap.exists) return { success: false, error: 'Transaction not found' };
  const tx = snap.data()!;

  // Only admin or buyer may refund
  const isAdmin = ADMIN_EMAILS.includes(session.user.email ?? '');
  if (tx.buyerId !== session.user.id && !isAdmin) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await db.collection('escrowTransactions').doc(transactionId).update({
      status: 'FEE_REFUNDED', updatedAt: new Date(),
    });
    await db.collection('auctions').doc(tx.auctionId).update({
      status: 'CANCELLED', updatedAt: new Date(),
    });
    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (e) {
    console.error('[escrow] refundEscrow failed:', e);
    return { success: false, error: 'Internal server error during refund' };
  }
}
