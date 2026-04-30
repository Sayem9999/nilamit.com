import { db } from '@/lib/db';
import { EscrowTransaction, EscrowStatus } from '@/types';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';

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
      return await db.runTransaction(async (tx) => {
        // 1. Find the exact escrow by its unique automation token
        const escrowSnap = await db.collection('escrowTransactions')
          .where('automationToken', '==', automationToken)
          .where('status', '==', 'PENDING')
          .limit(1)
          .get();

        if (escrowSnap.empty) {
          log.warn('Payment: No matching pending escrow found', { transactionId, amount, provider });
          return errorResponse(ErrorType.NOT_FOUND, 'Matching transaction not found');
        }

        const escrowDoc = escrowSnap.docs[0];
        const escrowData = escrowDoc.data() as EscrowTransaction;

        // 2. Prevent duplicate processing
        if (escrowData.providerRef === transactionId) {
          return successResponse(escrowData);
        }

        // 3. Update Escrow state to HELD
        const now = new Date();
        const updateData: Partial<EscrowTransaction> = {
          status: 'HELD' as EscrowStatus,
          providerRef: transactionId,
          paymentMethod: provider,
          updatedAt: now,
        };

        tx.update(escrowDoc.ref, updateData);

        // 4. Update Auction state to SOLD (if it was AWAITING_PAYMENT)
        const aRef = db.collection('auctions').doc(escrowData.auctionId);
        tx.update(aRef, {
          status: 'SOLD',
          updatedAt: now,
        });

        // 5. Notify parties via RTDB
        rtdbPush(RTDB_PATHS.userNotifications(escrowData.buyerId), {
          event: FIREBASE_EVENTS.PAYMENT_SUCCESS,
          message: `Payment verified. ${amount} BDT is now held in escrow.`,
          auctionId: escrowData.auctionId,
        }).catch(e => log.error('Payment: buyer notification failed', e));

        const fullData = { ...escrowData, ...updateData };
        log.info('Payment: Escrow successfully moved to HELD', { transactionId, escrowId: escrowDoc.id });

        return successResponse(fullData);
      });
    } catch (err) {
      log.error('Payment: verification failed', err, { transactionId });
      return errorResponse(ErrorType.INTERNAL, 'Payment processing failed');
    }
  }
}
