import { db } from '@/lib/db';
import { EscrowStatus } from '@/types/enums';
import { log } from '@/lib/logger';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';

/**
 * CommitmentService handles "Frictionless Seller Protection".
 * It ensures that if a buyer rejects an item without cause, the seller's shipping
 * costs are covered by deducting a "Logistics Fee" from the buyer's held escrow.
 */
export class CommitmentService {
  // Standard shipping fee in BD to cover outward + return (e.g., 60 + 60 = 120)
  static readonly STANDARD_SHIPPING_PROTECTION = 120;

  /**
   * Processes a refund to the buyer but deducts a logistics fee for the seller.
   * Use this when a buyer rejects an item at the doorstep for non-technical reasons.
   */
  static async refundWithLogisticsDeduction(transactionId: string, adminId: string): Promise<ServiceResponse<null>> {
    try {
      await db.runTransaction(async (tx) => {
        const ref = db.collection('escrowTransactions').doc(transactionId);
        const snap = await tx.get(ref);
        
        if (!snap.exists) throw new Error('Transaction not found');
        const data = snap.data();
        
        if (data?.status !== EscrowStatus.HELD) {
          throw new Error('Only HELD transactions can be refunded with deduction');
        }

        const fullAmount = data.amount;
        const protectionAmount = this.STANDARD_SHIPPING_PROTECTION;
        
        if (fullAmount <= protectionAmount) {
          throw new Error('Transaction amount is too small for logistics deduction');
        }

        // Logic: 
        // 1. Mark status as REFUNDED
        // 2. Log the deduction amount which goes to the Seller's balance
        // 3. The remaining goes to the Buyer
        tx.update(ref, {
          status: EscrowStatus.REFUNDED,
          resolution: 'REFUND_WITH_LOGISTICS_DEDUCTION',
          refundedToBuyer: fullAmount - protectionAmount,
          paidToSellerForShipping: protectionAmount,
          processedBy: adminId,
          updatedAt: new Date(),
        });

        log.info(`[CommitmentService] Refund processed for tx ${transactionId}. Buyer: ${fullAmount - protectionAmount}, Seller: ${protectionAmount}`);
      });

      return successResponse(null);
    } catch (e) {
      log.error('[CommitmentService] Smart refund failed', e);
      return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Refund failed');
    }
  }
}
