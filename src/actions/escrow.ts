'use server';

import { db, FieldValue } from '@/lib/db';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recalculateUserRating } from '@/lib/rating';
import { createLogisticsOrder } from './logistics';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

/**
 * Transitions PENDING → HELD (buyer confirms advance payment).
 */
export async function payEscrowAdvance(transactionId: string, providerRef?: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

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
      if (!aSnap.exists) throw new Error('Auction not found');
      // Use snapshot.id for the auction ID — never rely on data().id which may be absent
      const auction = { ...aSnap.data()!, id: aSnap.id } as {
        id: string; sellerId: string; title: string; [key: string]: unknown
      };

      const buyerRef  = db.collection('users').doc(session.user.id);
      const buyerSnap = await tx.get(buyerRef);
      const buyer     = buyerSnap.data() || {};

      if (!buyer.bkashNumber && !buyer.nagadNumber) {
        throw new Error('MFS_LINKAGE_REQUIRED');
      }

      const ref = providerRef ?? `PAY-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

      tx.update(txRef, {
        status:           'HELD',
        paymentMethod:    'bkash_automatic',
        providerRef:      ref,
        verificationType: 'AUTOMATIC',
        updatedAt:        new Date(),
      });

      // Create conversation on first payment
      const convRef  = db.collection('conversations').doc(t.auctionId);
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) {
        const now = new Date();
        tx.set(convRef, {
          id: t.auctionId, auctionId: t.auctionId, buyerId: t.buyerId,
          sellerId: auction.sellerId, lastMessageAt: now, createdAt: now,
        });
      }

      return { auction, buyer, ref };
    });

    await createLogisticsOrder(result.auction.id, result.auction.sellerId as string, session.user.id);

    await rtdbPush(RTDB_PATHS.userNotifications(result.auction.sellerId as string), {
      event:        FIREBASE_EVENTS.ADVANCE_PAID,
      auctionId:    result.auction.id,
      auctionTitle: result.auction.title,
      message:      `Payment held for "${result.auction.title}". Please prepare for shipment.`,
    });

    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[escrow] payEscrowAdvance failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Internal error', e instanceof Error ? e.message : undefined);
  }
}

/**
 * Buyer confirms item received — releases escrow.
 */
export async function confirmItemReceived(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef  = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (t.status !== 'HELD')           throw new Error('Not in a holdable state');

      tx.update(txRef, { status: 'RELEASED', updatedAt: new Date() });

      const aRef = db.collection('auctions').doc(t.auctionId);
      tx.update(aRef, { deliveryStatus: 'DELIVERED', updatedAt: new Date() });

      // Increment seller's sales count
      const sellerRef = db.collection('users').doc(t.sellerId);
      tx.update(sellerRef, { 
        salesCount: FieldValue.increment(1),
        updatedAt: new Date() 
      });

      return t;
    });

    const aSnap    = await db.collection('auctions').doc(result.auctionId).get();
    const sellerId = aSnap.data()?.sellerId as string | undefined;

    if (sellerId) {
      await Promise.all([
        recalculateUserRating(sellerId),
        recalculateUserRating(session.user.id),
        rtdbPush(RTDB_PATHS.userNotifications(sellerId), {
          event: FIREBASE_EVENTS.TRUST_UPDATE, message: 'Sale confirmed! Funds released.',
        }),
        updateSellerPerformance(sellerId),
      ]);
    }

    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[escrow] confirmItemReceived failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Internal error');
  }
}

/**
 * Seller confirms item shipped — updates tracking.
 */
export async function markAsShipped(transactionId: string, trackingNumber: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  if (!trackingNumber || trackingNumber.trim().length === 0 || trackingNumber.length > 128) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid tracking number.');
  }
  const safeTracking = trackingNumber.trim();

  let buyerId:   string;
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
      if (!aSnap.exists)                           throw new Error('Auction not found');
      if (aSnap.data()!.sellerId !== session.user.id) throw new Error('Unauthorized');

      tx.update(aRef, { deliveryStatus: 'SHIPPED', trackingNumber: safeTracking, updatedAt: new Date() });

      return { buyerId: t.buyerId as string, auctionId: t.auctionId as string };
    });

    buyerId   = result.buyerId;
    auctionId = result.auctionId;
  } catch (e) {
    log.error('[escrow] markAsShipped failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to mark as shipped.');
  }

  await rtdbPush(RTDB_PATHS.userNotifications(buyerId), {
    event: 'ITEM_SHIPPED', auctionId,
    message: `Your item has been shipped! Tracking: ${safeTracking}`,
  });

  revalidatePath('/dashboard');
  return successResponse(null);
}

/**
 * Refund escrow — SECURITY CRITICAL: Admins only.
 */
export async function refundEscrow(transactionId: string) {
  const adminSession = await requireAdmin().catch(() => null);
  if (!adminSession) {
    return errorResponse(ErrorType.FORBIDDEN, 'Access Denied: Admin intervention required for refunds.');
  }

  try {
    await db.runTransaction(async (t) => {
      const txRef  = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await t.get(txRef);
      if (!txSnap.exists) throw new Error('Not found');

      const txData = txSnap.data()!;
      if (!['HELD', 'DISPUTED', 'PENDING'].includes(txData.status)) {
        throw new Error(`Cannot refund escrow in status: ${txData.status}`);
      }

      t.update(txRef, { status: 'REFUNDED', updatedAt: new Date() });
      
      const aRef = db.collection('auctions').doc(txData.auctionId);
      const aSnap = await t.get(aRef);
      const auctionData = aSnap.data();

      t.update(aRef, {
        status: 'CANCELLED', updatedAt: new Date(),
      });

      if (auctionData?.sellerId) {
        t.update(db.collection('users').doc(auctionData.sellerId), {
          defectCount: FieldValue.increment(1),
          updatedAt: new Date(),
        });
      }

      return auctionData?.sellerId;
    }).then(async (sellerId) => {
      if (sellerId) {
        await updateSellerPerformance(sellerId);
      }
    });

    // Audit log for all admin financial actions
    await db.collection('admin_logs').add({
      action:    'REFUND_ESCROW',
      adminId:   adminSession.user.id,
      targetId:  transactionId,
      createdAt: new Date(),
    });

    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[escrow] refundEscrow failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Refund failed');
  }
}
