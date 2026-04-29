'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recalculateUserReputation } from '@/lib/reputation';
import { createLogisticsOrder } from './logistics';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';

/**
 * Transitions PENDING → HELD (buyer confirms advance payment).
 * Atomic transaction ensures logistics, chat, and escrow are synced.
 */
export async function payEscrowAdvance(transactionId: string, providerRef?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef  = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (t.status !== 'PENDING')        throw new Error('Advance already paid');

      const aRef  = db.collection('auctions').doc(t.auctionId);
      const aSnap = await tx.get(aRef);
      const auction = aSnap.data() || {};

      const buyerRef  = db.collection('users').doc(session.user.id);
      const buyerSnap = await tx.get(buyerRef);
      const buyer     = buyerSnap.data() || {};

      if (!buyer.bkashNumber && !buyer.nagadNumber) {
        throw new Error('MFS_LINKAGE_REQUIRED');
      }

      const ref = providerRef ?? `PAY-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

      // 1. Update Escrow
      tx.update(txRef, {
        status:           'HELD',
        paymentMethod:    'bkash_automatic',
        providerRef:      ref,
        verificationType: 'AUTOMATIC',
        updatedAt:        new Date(),
      });

      // 2. Activate Conversation
      const convId = t.auctionId;
      const convRef = db.collection('conversations').doc(convId);
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) {
        const now = new Date();
        tx.set(convRef, {
          id: convId, auctionId: t.auctionId, buyerId: t.buyerId, sellerId: auction.sellerId,
          lastMessageAt: now, createdAt: now,
        });
      }

      return { auction, buyer, ref };
    });

    // Post-transaction side effects (Logistics & Notifications)
    await createLogisticsOrder(result.auction.id, result.auction.sellerId, session.user.id);
    
    await rtdbPush(RTDB_PATHS.userNotifications(result.auction.sellerId), {
      event: FIREBASE_EVENTS.ADVANCE_PAID,
      auctionId: result.auction.id,
      auctionTitle: result.auction.title,
      message: `Payment held for "${result.auction.title}". Please prepare for shipment.`,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (e) {
    log.error('[escrow] Transaction failed', e);
    return { success: false, error: e instanceof Error ? e.message : 'Internal error' };
  }
}

/**
 * Buyer confirms item received — releases escrow.
 */
export async function confirmItemReceived(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef  = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (t.status !== 'HELD')           throw new Error('Not in a holdable state');

      tx.update(txRef, { status: 'RELEASED', updatedAt: new Date() });

      const aRef  = db.collection('auctions').doc(t.auctionId);
      tx.update(aRef, { deliveryStatus: 'DELIVERED', updatedAt: new Date() });
      
      return t;
    });

    const aSnap  = await db.collection('auctions').doc(result.auctionId).get();
    const sellerId = aSnap.data()?.sellerId;

    if (sellerId) {
      await Promise.all([
        recalculateUserReputation(sellerId),
        recalculateUserReputation(session.user.id),
        rtdbPush(RTDB_PATHS.userNotifications(sellerId), {
          event: FIREBASE_EVENTS.TRUST_UPDATE, message: 'Sale confirmed! Funds released.',
        }),
      ]);
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (e) {
    log.error('[escrow] confirmItemReceived failed', e);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Seller confirms item shipped — updates tracking.
 */
export async function markAsShipped(transactionId: string, trackingNumber: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  if (!trackingNumber || trackingNumber.trim().length === 0 || trackingNumber.length > 128) {
    return { success: false, error: 'Invalid tracking number.' };
  }
  const safeTracking = trackingNumber.trim();

  let buyerId: string;
  let auctionId: string;

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef  = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.status !== 'HELD') throw new Error('Invalid state');

      const aRef  = db.collection('auctions').doc(t.auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error('Auction not found');
      if (aSnap.data()!.sellerId !== session.user.id) throw new Error('Unauthorized');

      tx.update(aRef, { deliveryStatus: 'SHIPPED', trackingNumber: safeTracking, updatedAt: new Date() });

      return { buyerId: t.buyerId as string, auctionId: t.auctionId as string };
    });

    buyerId   = result.buyerId;
    auctionId = result.auctionId;
  } catch (e) {
    log.error('[escrow] markAsShipped failed', e);
    return { success: false, error: e instanceof Error ? e.message : 'Failed to mark as shipped.' };
  }

  await rtdbPush(RTDB_PATHS.userNotifications(buyerId), {
    event: 'ITEM_SHIPPED',
    auctionId,
    message: `Your item has been shipped! Tracking: ${safeTracking}`,
  });

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Refund escrow — SECURITY CRITICAL: Restricted to Admins only.
 */
export async function refundEscrow(transactionId: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: 'Access Denied: Admin intervention required for refunds.' };
  }

  try {
    const txRef = db.collection('escrowTransactions').doc(transactionId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return { success: false, error: 'Not found' };
    
    const tx = txSnap.data()!;
    await db.runTransaction(async (t) => {
      t.update(txRef, { status: 'REFUNDED', updatedAt: new Date() });
      t.update(db.collection('auctions').doc(tx.auctionId), { status: 'CANCELLED' });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (_error) {
    return { success: false, error: 'Refund failed' };
  }
}
