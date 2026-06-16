'use server';

import { db, FieldValue } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { pushUserNotification } from '@/lib/firebase-admin';
import { FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recalculateUserRating } from '@/lib/rating';
import { createLogisticsOrder } from '@/lib/logistics';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { adminRefundEscrow } from './dispute';
import { AuditService } from '@/services/admin/audit-service';
import { recordLedgerEntry } from '@/lib/ledger';
import { confirmItemReceivedForUser, markAsShippedForUser } from '@/services/escrow/escrow-core';

/**
 * Transitions PENDING → VERIFICATION_PENDING (buyer submits MFS payment ref).
 * Admin treasury approval transitions VERIFICATION_PENDING → HELD
 * (see `approveEscrowPayment` in actions/admin/treasury.ts).
 */
export async function payEscrowAdvance(transactionId: string, providerRef?: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  // providerRef is client-supplied free text (an MFS TrxID) — bound it before
  // it reaches Firestore, the ledger, and admin screens.
  if (providerRef !== undefined) {
    providerRef = providerRef.trim();
    if (providerRef.length === 0) providerRef = undefined;
    else if (providerRef.length > 64 || !/^[\w\- ]+$/.test(providerRef)) {
      return errorResponse(ErrorType.VALIDATION, 'Invalid payment reference format.');
    }
  }

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
        buyerName:     (buyer.name as string | undefined) ?? null,
        buyerPhone:    (buyer.phoneNumber as string | undefined) ?? (buyer.bkashNumber as string | undefined) ?? (buyer.nagadNumber as string | undefined) ?? null,
        ref,
        codAmount:     t.codAmount ?? 0,
        amount:        (t.amount as number) ?? 0,
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
        recipientName:   result.buyerName,
        recipientPhone:  result.buyerPhone,
      });

      await pushUserNotification(result.auction.sellerId as string, {
        event:        FIREBASE_EVENTS.ADVANCE_PAID,
        auctionId:    result.auction.id,
        auctionTitle: result.auction.title,
        message:      `Payment submitted for "${result.auction.title}". Verification pending.`,
        timestamp:    Date.now(),
      });

      // Ledger: buyer submitted an MFS reference (no funds confirmed yet → NONE).
      await recordLedgerEntry({
        type: 'ADVANCE_SUBMITTED',
        direction: 'NONE',
        escrowId: transactionId,
        auctionId: result.auction.id,
        amount: result.amount,
        buyerId: session.user.id,
        sellerId: result.auction.sellerId as string,
        paymentMethod: 'mfs_manual',
        providerRef: result.ref,
        operatorId: session.user.id,
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
 * Gateway path for the escrow advance: seed a high-entropy `automationToken`
 * onto the buyer's PENDING escrow so the signed payment callback can locate it
 * (verifyAndReleaseEscrow queries by automationToken). Returns the token + the
 * required amount; the caller (POST /api/payments/sslcommerz/init) feeds these
 * into the gateway session as tran_id + value_a.
 *
 * Idempotent: re-running on an escrow that already has a token returns the same
 * token (so a retried checkout reuses the session identity).
 */
export async function initEscrowGatewayPayment(
  transactionId: string,
): Promise<ServiceResponse<{ automationToken: string; amountBdt: number }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    const out = await db.runTransaction(async (tx) => {
      const txRef = db.collection('escrowTransactions').doc(transactionId);
      const snap = await tx.get(txRef);
      if (!snap.exists) throw new Error('Transaction not found');
      const t = snap.data()!;

      if (t.buyerId !== session.user.id) throw new Error('Unauthorized');
      if (t.status !== 'PENDING') throw new Error('Advance already paid or verification pending');

      const existing = t.automationToken as string | undefined;
      const token = existing ?? `esc_${randomUUID().replace(/-/g, '')}`;
      if (!existing) {
        tx.update(txRef, { automationToken: token, paymentMethod: 'gateway', updatedAt: new Date() });
      }
      return { token, amount: (t.amount as number) ?? 0 };
    });

    return successResponse({ automationToken: out.token, amountBdt: out.amount });
  } catch (e) {
    log.error('[escrow] initEscrowGatewayPayment failed', e, { area: 'escrow', severity: 'warning' });
    const code = e instanceof Error ? e.message : '';
    const msg =
      code === 'Unauthorized' ? 'You are not authorized to pay this transaction.'
      : code === 'Transaction not found' ? 'Transaction not found.'
      : code === 'Advance already paid or verification pending' ? 'Payment already submitted for this transaction.'
      : 'Could not start gateway payment.';
    return errorResponse(ErrorType.INTERNAL, msg);
  }
}

/**
 * Buyer confirms item received — releases escrow.
 */
export async function confirmItemReceived(transactionId: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  // Shared with the native bridge (/api/mobile/escrow) via confirmItemReceivedForUser.
  return confirmItemReceivedForUser(session.user.id, transactionId);
}

/**
 * Seller confirms item shipped — updates tracking.
 */
export async function markAsShipped(transactionId: string, trackingNumber: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  // Shared with the native bridge (/api/mobile/escrow) via markAsShippedForUser.
  return markAsShippedForUser(session.user.id, transactionId, trackingNumber);
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
