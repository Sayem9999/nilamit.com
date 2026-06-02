import * as Sentry from "@sentry/nextjs";
import { db } from '@/lib/db';
import { EscrowTransaction, EscrowStatus } from '@/types';
import { AuditService } from '@/services/admin/audit-service';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';
import { pushUserNotification } from '@/lib/firebase-admin';
import { FIREBASE_EVENTS } from '@/lib/firebase-events';
import { recordLedgerEntry } from '@/lib/ledger';

/**
 * Settled payment rails. `card`/`sslcommerz` are NOT MFS providers — keeping
 * them distinct prevents card brands (VISA/MASTER) from being written into the
 * ledger as if they were bKash/Nagad (audit finding C3).
 */
export type PaymentProvider = 'bkash' | 'nagad' | 'sslcommerz' | 'card';

export class PaymentService {
  /**
   * Process an incoming MFS / gateway payment callback and, if it checks out,
   * move the matching escrow into HELD.
   */
  static async verifyAndReleaseEscrow(
    automationToken: string,
    transactionId: string,
    amount: number,
    provider: PaymentProvider
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

        // Read the auction up front. Firestore transactions require ALL reads
        // before ANY write — the previous code read the auction AFTER updating
        // the escrow, which throws "transactions require all reads to be
        // executed before all writes" and silently broke the release path
        // (audit follow-up C5). Hoisting the read fixes it.
        const aRef = db.collection('auctions').doc(escrowData.auctionId);
        const aSnap = await tx.get(aRef);

        // 2. Idempotency — a duplicate callback for an already-processed escrow
        //    returns success so the gateway stops retrying / alerting.
        if (escrowData.status === 'HELD' && escrowData.providerRef === transactionId) {
          return successResponse(escrowData);
        }

        // 3. Only a pre-funded escrow can be moved to HELD. Both PENDING (no
        //    buyer action yet) and VERIFICATION_PENDING (buyer submitted a
        //    manual MFS reference) are valid sources — this reconciles the
        //    automated gateway path with the manual advance path so a gateway
        //    confirmation can settle either (audit finding H2).
        if (escrowData.status !== 'PENDING' && escrowData.status !== 'VERIFICATION_PENDING') {
          log.warn('Payment: escrow not in a payable state', { transactionId, status: escrowData.status });
          return errorResponse(ErrorType.CONFLICT, `Escrow is in ${escrowData.status} state, cannot release.`);
        }

        // 4. AMOUNT RECONCILIATION (audit finding C1) — never mark an escrow
        //    HELD for less than the required advance. Without this, a buyer who
        //    pays ৳1 (tampered init / underpayment) still gets funds "held",
        //    silently diverging the ledger from cash actually received.
        const requiredAmount = Number(escrowData.amount) || 0;
        if (Number(amount) < requiredAmount) {
          log.error('Payment: underpayment rejected', {
            transactionId, paid: amount, required: requiredAmount, provider,
            area: 'escrow', severity: 'critical',
          });
          return errorResponse(
            ErrorType.CONFLICT,
            `Paid amount (৳${amount}) is below the required advance (৳${requiredAmount}).`,
          );
        }

        // 5. Update Escrow state to HELD
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

        // 6. Update Auction state to SOLD (auction was read above, before writes)
        const beforeAuction = aSnap.data() || null;
        const updateAuction = {
          status: 'SOLD',
          updatedAt: now,
        };
        const afterAuction = beforeAuction ? { ...beforeAuction, ...updateAuction } : null;

        tx.update(aRef, updateAuction);
        await AuditService.logAuctionChange(escrowData.auctionId, beforeAuction, afterAuction, 'UPDATE', 'system', tx);

        // 7. Notify parties via RTDB
        pushUserNotification(escrowData.buyerId, {
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
