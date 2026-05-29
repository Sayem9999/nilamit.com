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
import { AuditService } from '@/services/admin/audit-service';

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
      const configRef = db.collection('systemConfig').doc('default');
      const [buyerSnap, configSnap] = await Promise.all([
        tx.get(buyerRef),
        tx.get(configRef),
      ]);
      const buyer     = buyerSnap.data() || {};
      const systemConfig = configSnap.exists ? configSnap.data() : null;
      const mfsReq = systemConfig?.mfsLinkageRequired ?? true;

      if (mfsReq && !buyer.bkashNumber && !buyer.nagadNumber) {
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

      const convRef  = db.collection('conversations').doc(t.auctionId);
      const convSnap = await tx.get(convRef);

      const beforeState = { ...t };
      const updateData = {
        status:           'VERIFICATION_PENDING',
        paymentMethod:    'mfs_manual',
        providerRef:      ref,
        verificationType: 'MANUAL',
        updatedAt:        new Date(),
      };
      const afterState = { ...beforeState, ...updateData };

      tx.update(txRef, updateData);
      await AuditService.logEscrowChange(transactionId, beforeState, afterState, 'UPDATE', session.user.id, tx);

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
        codAmount:     t.codAmount ?? 0,
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
        codAmount:       result.codAmount,
      });

      await rtdbPush(RTDB_PATHS.userNotifications(result.auction.sellerId as string), {
        event:        FIREBASE_EVENTS.ADVANCE_PAID,
        auctionId:    result.auction.id,
        auctionTitle: result.auction.title,
        message:      `Payment submitted for "${result.auction.title}". Verification pending.`,
        timestamp:    Date.now(),
      });
    } catch (sideEffectErr) {
      log.error('[escrow] side-effects failed after successful TX', sideEffectErr, { area: 'escrow', severity: 'warning' });
    }

    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (e) {
    log.error('[escrow] payEscrowAdvance failed', e, { area: 'escrow', severity: 'critical' });
    const code = e instanceof Error ? e.message : '';
    const USER_MESSAGES: Record<string, string> = {
      'MFS_LINKAGE_REQUIRED':  'Please link a bKash or Nagad account in your profile before paying.',
      'ADDRESS_REQUIRED':      'Please add your delivery address in your profile settings.',
      'SELLER_ADDRESS_MISSING':'The seller has not added a shipping address yet. Contact support.',
      'Transaction not found': 'Transaction not found.',
      'Unauthorized':          'You are not authorized to perform this action.',
      'Advance already paid or verification pending': 'Payment has already been submitted for this transaction.',
    };
    const msg = USER_MESSAGES[code] ?? 'Payment processing failed. Please try again.';
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
      const beforeEscrow = { ...t };
      const updateEscrow = { status: 'RELEASED', updatedAt: now };
      const afterEscrow = { ...beforeEscrow, ...updateEscrow };

      tx.update(txRef, updateEscrow);
      await AuditService.logEscrowChange(transactionId, beforeEscrow, afterEscrow, 'UPDATE', session.user.id, tx);

      const aRef = db.collection('auctions').doc(t.auctionId);
      const aSnap = await tx.get(aRef);
      const beforeAuction = aSnap.data() || null;
      const updateAuction = { deliveryStatus: 'DELIVERED', updatedAt: now };
      const afterAuction = beforeAuction ? { ...beforeAuction, ...updateAuction } : null;

      tx.update(aRef, updateAuction);
      await AuditService.logAuctionChange(t.auctionId, beforeAuction, afterAuction, 'UPDATE', session.user.id, tx);

      tx.update(db.collection('users').doc(t.sellerId), {
        salesCount: FieldValue.increment(1),
        updatedAt:  now,
      });

      return t;
    });

    try {
      const aSnap    = await db.collection('auctions').doc(result.auctionId).get();
      const sellerId = aSnap.data()?.sellerId as string | undefined;

      if (sellerId) {
        await Promise.all([
          recalculateUserRating(sellerId),
          recalculateUserRating(session.user.id),
          rtdbPush(RTDB_PATHS.userNotifications(sellerId), {
            event: FIREBASE_EVENTS.TRUST_UPDATE, message: 'Sale confirmed! Funds released.',
            timestamp: Date.now(),
          }),
          updateSellerPerformance(sellerId),
        ]);
      }
    } catch (err) {
      log.error('[escrow] updates failed after successful TX', err, { area: 'escrow', severity: 'warning' });
    }

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

      const beforeAuction = aSnap.data() || null;
      const updateAuction = { deliveryStatus: 'SHIPPED', trackingNumber: safeTracking, updatedAt: new Date() };
      const afterAuction = beforeAuction ? { ...beforeAuction, ...updateAuction } : null;

      tx.update(aRef, updateAuction);
      await AuditService.logAuctionChange(t.auctionId, beforeAuction, afterAuction, 'UPDATE', session.user.id, tx);

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
    timestamp: Date.now(),
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
