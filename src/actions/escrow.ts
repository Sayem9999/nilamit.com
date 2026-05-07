'use server';

import { db, FieldValue } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recalculateUserRating } from '@/lib/rating';
import { createLogisticsOrder } from '@/lib/logistics';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { adminRefundEscrow } from './dispute';

/**
 * Transitions PENDING → VERIFICATION_PENDING (buyer submits MFS payment ref).
 * Admin treasury approval transitions VERIFICATION_PENDING → HELD
 * (see `approveEscrowPayment` in actions/admin/treasury.ts).
 */
export async function payEscrowAdvance(transactionId: string, providerRef?: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef  = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (t.status !== 'PENDING')        throw new Error('Advance already paid or verification pending');

      const aRef  = db.collection('auctions').doc(t.auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error('Auction not found');

      const auction = { ...aSnap.data()!, id: aSnap.id } as {
        id: string; sellerId: string; title: string; [key: string]: unknown
      };

      const buyerRef  = db.collection('users').doc(session.user.id);
      const buyerSnap = await tx.get(buyerRef);
      const buyer     = buyerSnap.data() || {};

      if (!buyer.bkashNumber && !buyer.nagadNumber) {
        throw new Error('MFS_LINKAGE_REQUIRED');
      }
      if (!buyer.address) {
        throw new Error('ADDRESS_REQUIRED');
      }

      // Look up seller's address inside the same transaction so logistics
      // can be created consistently after commit. Both addresses become
      // visible only to the buyer/seller pair (see logistics module).
      const sellerSnap = await tx.get(db.collection('users').doc(auction.sellerId));
      const seller = sellerSnap.data() || {};
      if (!seller.address) {
        throw new Error('SELLER_ADDRESS_MISSING');
      }

      const ref = providerRef ?? `PAY-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

      tx.update(txRef, {
        status:           'VERIFICATION_PENDING',
        paymentMethod:    'mfs_manual',
        providerRef:      ref,
        verificationType: 'MANUAL',
        updatedAt:        new Date(),
      });

      const convRef  = db.collection('conversations').doc(t.auctionId);
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) {
        const now = new Date();
        tx.set(convRef, {
          id: t.auctionId,
          auctionId: t.auctionId,
          buyerId: t.buyerId,
          sellerId: auction.sellerId,
          lastMessageAt: now,
          lastMessageContent: 'Escrow payment submitted for verification.',
          lastMessageSenderId: 'system',
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        auction,
        buyerAddress:  buyer.address as string,
        sellerAddress: seller.address as string,
        ref,
      };
    });

    // Post-transaction side-effects. Logistics call is now an internal helper
    // (server-only, not 'use server'), bypassing the public Server Action surface.
    try {
      await createLogisticsOrder({
        auctionId:       result.auction.id,
        sellerId:        result.auction.sellerId as string,
        buyerId:         session.user.id,
        sellerAddress:   result.sellerAddress,
        buyerAddress:    result.buyerAddress,
      });

      await rtdbPush(RTDB_PATHS.userNotifications(result.auction.sellerId as string), {
        event:        FIREBASE_EVENTS.ADVANCE_PAID,
        auctionId:    result.auction.id,
        auctionTitle: result.auction.title,
        message:      `Payment submitted for "${result.auction.title}". Verification pending.`,
      });
    } catch (sideEffectErr) {
      log.error('[escrow] side-effects failed after successful TX', sideEffectErr, { area: 'escrow', severity: 'warning' });
    }

    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[escrow] payEscrowAdvance failed', e, { area: 'escrow', severity: 'critical' });
    const msg = e instanceof Error ? e.message : 'Internal error';
    return errorResponse(ErrorType.INTERNAL, msg);
  }
}

/**
 * Buyer confirms item received — releases escrow.
 */
export async function confirmItemReceived(transactionId: string): Promise<ServiceResponse<null>> {
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

      const now = new Date();
      tx.update(txRef, { status: 'RELEASED', updatedAt: now });

      const aRef = db.collection('auctions').doc(t.auctionId);
      tx.update(aRef, { deliveryStatus: 'DELIVERED', updatedAt: now });

      tx.update(db.collection('users').doc(t.sellerId), {
        salesCount: FieldValue.increment(1),
        updatedAt:  now,
      });

      return t;
    });

    void (async () => {
      try {
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
      } catch (err) {
        log.error('[escrow] background updates failed', err, { area: 'escrow', severity: 'warning' });
      }
    })();

    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[escrow] confirmItemReceived failed', e, { area: 'escrow', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, 'Confirmation failed');
  }
}

/**
 * Seller confirms item shipped — updates tracking.
 */
export async function markAsShipped(transactionId: string, trackingNumber: string): Promise<ServiceResponse<null>> {
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
      if (!aSnap.exists)                              throw new Error('Auction not found');
      if (aSnap.data()!.sellerId !== session.user.id) throw new Error('Unauthorized');

      tx.update(aRef, { deliveryStatus: 'SHIPPED', trackingNumber: safeTracking, updatedAt: new Date() });

      return { buyerId: t.buyerId as string, auctionId: t.auctionId as string };
    });

    buyerId   = result.buyerId;
    auctionId = result.auctionId;
  } catch (e) {
    log.error('[escrow] markAsShipped failed', e, { area: 'escrow', severity: 'warning' });
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
 * Refund escrow — admin only. Delegates to the consolidated `adminRefundEscrow`
 * so reason validation, status checks, defect-count, and audit logging stay in
 * one place. Kept for backwards compatibility with existing UI buttons that
 * don't yet collect a reason.
 */
export async function refundEscrow(transactionId: string, reason = 'Admin-initiated refund (no reason provided)'): Promise<ServiceResponse<null>> {
  return adminRefundEscrow(transactionId, reason);
}
