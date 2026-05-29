import * as Sentry from "@sentry/nextjs";
import { db } from '@/lib/db';
import { EscrowTransaction, EscrowStatus } from '@/types';
import { AuditService } from '@/services/admin/audit-service';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recordLedgerEntry } from '@/lib/ledger';

export class PaymentService {
  /**
   * Process an incoming MFS payment (bKash/Nagad)
   * This is a "stub" for the actual webhook integration.
   */
  static async verifyAndReleaseEscrow(
    automationToken: string,
    transactionId: string,
    amount: number, 
    provider: 'bkash' | 'nagad'
  ): Promise<ServiceResponse<EscrowTransaction>> {
    try {
      let didTransition = false;
      let held: EscrowTransaction | null = null;
      const res = await db.runTransaction(async (tx) => {
        // 1. Find the escrow by its automation token (NOT status-filtered, so a
        //    replayed webhook for an already-HELD escrow can be detected and
        //    answered idempotently instead of returning a misleading 404).
        const query = db.collection('escrowTransactions')
          .where('automationToken', '==', automationToken)
          .limit(1);
        const escrowSnap = await tx.get(query);

        if (escrowSnap.empty) {
          log.warn('Payment: No matching escrow found', { transactionId, amount, provider });
          return errorResponse(ErrorType.NOT_FOUND, 'Matching transaction not found');
        }

        const escrowDoc = escrowSnap.docs[0];
        const escrowData = escrowDoc.data() as EscrowTransaction;

        // 2. Idempotency — a duplicate callback for an already-processed escrow
        //    returns success so the gateway stops retrying / alerting.
        if (escrowData.status === 'HELD' && escrowData.providerRef === transactionId) {
          return successResponse(escrowData);
        }

        // 3. Only a PENDING escrow can be moved to HELD.
        if (escrowData.status !== 'PENDING') {
          log.warn('Payment: escrow not in a payable state', { transactionId, status: escrowData.status });
          return errorResponse(ErrorType.CONFLICT, `Escrow is in ${escrowData.status} state, cannot release.`);
        }

        // 3. Update Escrow state to HELD
        const now = new Date();
        const updateData: Partial<EscrowTransaction> = {
          status: 'HELD' as EscrowStatus,
          providerRef: transactionId,
          paymentMethod: provider,
          updatedAt: now,
        };

        const beforeEscrow = { ...escrowData };
        const afterEscrow = { ...beforeEscrow, ...updateData };

        tx.update(escrowDoc.ref, updateData);
        await AuditService.logEscrowChange(escrowDoc.id, beforeEscrow, afterEscrow, 'UPDATE', 'system', tx);

        // 4. Update Auction state to SOLD (if it was AWAITING_PAYMENT)
        const aRef = db.collection('auctions').doc(escrowData.auctionId);
        const aSnap = await tx.get(aRef);
        const beforeAuction = aSnap.data() || null;
        const updateAuction = {
          status: 'SOLD',
          updatedAt: now,
        };
        const afterAuction = beforeAuction ? { ...beforeAuction, ...updateAuction } : null;

        tx.update(aRef, updateAuction);
        await AuditService.logAuctionChange(escrowData.auctionId, beforeAuction, afterAuction, 'UPDATE', 'system', tx);

        // 5. Notify parties via RTDB
        rtdbPush(RTDB_PATHS.userNotifications(escrowData.buyerId), {
          event: FIREBASE_EVENTS.PAYMENT_SUCCESS,
          message: `Payment verified. ${amount} BDT is now held in escrow.`,
          auctionId: escrowData.auctionId,
          timestamp: Date.now(),
        }).catch(e => log.error('Payment: buyer notification failed', e));

        const fullData = { ...escrowData, ...updateData };
        didTransition = true;
        held = fullData as EscrowTransaction;
        log.info('Payment: Escrow successfully moved to HELD', { transactionId, escrowId: escrowDoc.id });

        return successResponse(fullData);
      });

      // Ledger (post-commit; only on a real PENDING→HELD transition, never on
      // an idempotent replay — so the IN total can't be double-counted).
      if (res.success && didTransition && held) {
        const h: EscrowTransaction = held;
        await recordLedgerEntry({
          type: 'ADVANCE_HELD',
          direction: 'IN',
          escrowId: h.id,
          auctionId: h.auctionId,
          amount: (h.amount as number) ?? amount ?? 0,
          buyerId: h.buyerId,
          sellerId: h.sellerId,
          paymentMethod: provider,
          providerRef: transactionId,
          operatorId: 'system',
        });
      }
      return res;
    } catch (err) {
      Sentry.captureException(err, {
        extra: { transactionId, automationToken, amount, provider }
      });
      log.error('Payment: verification failed', err, { transactionId });
      return errorResponse(ErrorType.INTERNAL, 'Payment processing failed');
    }
  }
}
