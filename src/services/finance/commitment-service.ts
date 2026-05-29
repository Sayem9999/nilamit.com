import { db } from '@/lib/db';
import { EscrowStatus } from '@/types/enums';
import { log } from '@/lib/logger';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { recordLedgerEntry } from '@/lib/ledger';

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
      const info = await db.runTransaction(async (tx) => {
        const ref = db.collection('escrowTransactions').doc(transactionId);
        const snap = await tx.get(ref);

        if (!snap.exists) throw new Error('Transaction not found');
        const data = snap.data()!;

        if (data.status !== EscrowStatus.HELD) {
          throw new Error('Only HELD transactions can be refunded with deduction');
        }

        const fullAmount = data.amount as number;
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

        return {
          buyerId: (data.buyerId as string) ?? null,
          sellerId: (data.sellerId as string) ?? null,
          auctionId: (data.auctionId as string) ?? transactionId,
          refundedToBuyer: fullAmount - protectionAmount,
          sellerShip: protectionAmount,
        };
      });

      // Ledger: HELD funds leave escrow as a partial refund — the buyer portion
      // (REFUND) plus the retained logistics fee paid to the seller (OUT). The
      // two together equal the full held amount, so Held reconciles to zero.
      await recordLedgerEntry({
        type: 'REFUNDED', direction: 'REFUND',
        escrowId: transactionId, auctionId: info.auctionId,
        amount: info.refundedToBuyer, buyerId: info.buyerId, sellerId: info.sellerId,
        operatorId: adminId, metadata: { reason: 'refund_with_logistics_deduction' },
      });
      await recordLedgerEntry({
        type: 'RELEASED', direction: 'OUT',
        escrowId: transactionId, auctionId: info.auctionId,
        amount: info.sellerShip, buyerId: info.buyerId, sellerId: info.sellerId,
        operatorId: adminId, metadata: { reason: 'logistics_protection_fee' },
      });

      return successResponse(null);
    } catch (e) {
      log.error('[CommitmentService] Smart refund failed', e);
      return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Refund failed');
    }
  }
}
