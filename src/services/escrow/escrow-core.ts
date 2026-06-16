/**
 * escrow-core.ts — shared post-sale escrow/dispute logic, parameterized by
 * userId so the web Server Actions (src/actions/escrow.ts, dispute.ts) and the
 * native bridge (/api/mobile/escrow) run the SAME money-movement transactions.
 * Server-only lib (not 'use server').
 */
import { db, FieldValue } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { pushUserNotification } from '@/lib/firebase-admin';
import { FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recalculateUserRating } from '@/lib/rating';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { AuditService } from '@/services/admin/audit-service';
import { recordLedgerEntry } from '@/lib/ledger';
import { raiseDisputeSchema, formatZodError } from '@/lib/schemas';

/** Buyer confirms item received — releases escrow to the seller. */
export async function confirmItemReceivedForUser(userId: string, transactionId: string): Promise<ServiceResponse<null>> {
  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.buyerId !== userId) throw new Error('Unauthorized');
      if (t.status !== 'HELD') throw new Error('Not in a holdable state');

      const now = new Date();
      const beforeEscrow = { ...t };
      const updateEscrow = { status: 'RELEASED', updatedAt: now };
      const afterEscrow = { ...beforeEscrow, ...updateEscrow };

      tx.update(txRef, updateEscrow);
      await AuditService.logEscrowChange(transactionId, beforeEscrow, afterEscrow, 'UPDATE', userId, tx);

      const aRef = db.collection('auctions').doc(t.auctionId);
      const aSnap = await tx.get(aRef);
      const beforeAuction = aSnap.data() || null;
      const updateAuction = { deliveryStatus: 'DELIVERED', updatedAt: now };
      const afterAuction = beforeAuction ? { ...beforeAuction, ...updateAuction } : null;

      tx.update(aRef, updateAuction);
      await AuditService.logAuctionChange(t.auctionId, beforeAuction, afterAuction, 'UPDATE', userId, tx);

      tx.update(db.collection('users').doc(t.sellerId), {
        salesCount: FieldValue.increment(1),
        updatedAt: now,
      });

      return t;
    });

    try {
      const aSnap = await db.collection('auctions').doc(result.auctionId).get();
      const sellerId = aSnap.data()?.sellerId as string | undefined;

      if (sellerId) {
        await Promise.all([
          recalculateUserRating(sellerId),
          recalculateUserRating(userId),
          pushUserNotification(sellerId, {
            event: FIREBASE_EVENTS.TRUST_UPDATE,
            message: 'Sale confirmed! Funds released.',
            timestamp: Date.now(),
          }),
          updateSellerPerformance(sellerId),
        ]);
      }

      await recordLedgerEntry({
        type: 'RELEASED',
        direction: 'OUT',
        escrowId: transactionId,
        auctionId: result.auctionId as string,
        amount: (result.amount as number) ?? 0,
        buyerId: result.buyerId as string,
        sellerId: result.sellerId as string,
        operatorId: userId,
      });
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

/** Seller marks the item shipped with a tracking number. */
export async function markAsShippedForUser(
  userId: string,
  transactionId: string,
  trackingNumber: string,
): Promise<ServiceResponse<null>> {
  if (!trackingNumber || trackingNumber.trim().length === 0 || trackingNumber.length > 128) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid tracking number.');
  }
  const safeTracking = trackingNumber.trim();

  let buyerId: string;
  let auctionId: string;

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (t.status !== 'HELD') throw new Error('Invalid state');

      const aRef = db.collection('auctions').doc(t.auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error('Auction not found');
      if (aSnap.data()!.sellerId !== userId) throw new Error('Unauthorized');

      const beforeAuction = aSnap.data() || null;
      const updateAuction = { deliveryStatus: 'SHIPPED', trackingNumber: safeTracking, updatedAt: new Date() };
      const afterAuction = beforeAuction ? { ...beforeAuction, ...updateAuction } : null;

      tx.update(aRef, updateAuction);
      await AuditService.logAuctionChange(t.auctionId, beforeAuction, afterAuction, 'UPDATE', userId, tx);

      return { buyerId: t.buyerId as string, auctionId: t.auctionId as string };
    });

    buyerId = result.buyerId;
    auctionId = result.auctionId;
  } catch (e) {
    log.error('[escrow] markAsShipped failed', e, { area: 'escrow', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to mark as shipped.');
  }

  await pushUserNotification(buyerId, {
    event: 'ITEM_SHIPPED',
    auctionId,
    message: `Your item has been shipped! Tracking: ${safeTracking}`,
    timestamp: Date.now(),
  });

  revalidatePath('/dashboard');
  return successResponse(null);
}

/** Buyer raises a dispute on a HELD escrow. */
export async function raiseDisputeForUser(
  userId: string,
  transactionId: string,
  reason: string,
): Promise<ServiceResponse<null>> {
  const parsed = raiseDisputeSchema.safeParse({ transactionId, reason });
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const disputeRef = db.collection('disputes').doc(transactionId);
  const escrowRef = db.collection('escrowTransactions').doc(transactionId);

  try {
    await db.runTransaction(async (tx) => {
      const [escrowSnap, disputeSnap] = await Promise.all([tx.get(escrowRef), tx.get(disputeRef)]);

      if (!escrowSnap.exists) throw new Error('Transaction not found');
      const escrow = escrowSnap.data()!;
      if (escrow.buyerId !== userId) throw new Error('Unauthorized');
      if (escrow.status !== 'HELD') throw new Error('Dispute only valid for held escrow.');
      if (disputeSnap.exists) throw new Error('Dispute already exists.');

      const now = new Date();
      tx.set(disputeRef, {
        id: transactionId,
        transactionId,
        openerId: userId,
        reason: parsed.data.reason,
        status: 'OPEN',
        resolution: null,
        createdAt: now,
        updatedAt: now,
      });
      const beforeState = { ...escrow };
      const updateData = { status: 'DISPUTED', updatedAt: now };
      const afterState = { ...beforeState, ...updateData };
      tx.update(escrowRef, updateData);
      await AuditService.logEscrowChange(transactionId, beforeState, afterState, 'UPDATE', userId, tx);
    });

    revalidatePath('/dashboard/escrow');
    return successResponse(null);
  } catch (e) {
    log.error('[dispute] raiseDispute failed', e, { area: 'dispute', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Failed to raise dispute.');
  }
}
