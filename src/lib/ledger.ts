import 'server-only';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

/**
 * Financial ledger — an append-only, money-centric record of every escrow
 * movement, written alongside (but separate from) the per-document state-diff
 * audit log (AuditService → history_logs).
 *
 * Why a separate ledger: the audit log answers "what changed on this doc",
 * which is hard to aggregate financially. The ledger answers "how much money
 * moved, which direction, between whom, via what reference" — the basis for
 * reconciliation against bKash/Nagad statements and closing the books.
 *
 * Source of truth for escrow STATE remains the escrowTransactions doc; the
 * ledger is the auditable financial TRAIL.
 */

export type LedgerEntryType =
  | 'ADVANCE_SUBMITTED' // buyer submitted an MFS reference (PENDING → VERIFICATION_PENDING) — not yet money
  | 'ADVANCE_HELD'      // payment verified; funds now held in escrow
  | 'RELEASED'          // funds released to the seller
  | 'REFUNDED'          // funds refunded to the buyer
  | 'CANCELLED';        // unpaid sale cancelled — no funds moved

/**
 * Direction relative to the platform escrow account, used for reconciliation
 * sums. NONE = a recorded event where no money actually moved (submitted /
 * cancelled), so it never inflates IN/OUT totals.
 */
export type LedgerDirection = 'IN' | 'OUT' | 'REFUND' | 'NONE';

export interface LedgerEntryInput {
  type: LedgerEntryType;
  escrowId: string;
  auctionId: string;
  amount: number;
  direction: LedgerDirection;
  buyerId?: string | null;
  sellerId?: string | null;
  paymentMethod?: string | null;
  providerRef?: string | null;
  /** admin/user/system that triggered the movement */
  operatorId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an immutable entry to `ledgerEntries`.
 *
 * Fire-and-forget by design: a ledger write must NEVER break the escrow
 * operation it records. Callers invoke this AFTER the money transaction
 * commits; it swallows its own errors (logged + Sentry-tagged) so a ledger
 * hiccup can't roll back a real payment. Missing entries are rare and
 * reconcilable against escrowTransactions + history_logs.
 */
export async function recordLedgerEntry(entry: LedgerEntryInput): Promise<void> {
  try {
    const ref = db.collection('ledgerEntries').doc();
    await ref.set({
      id: ref.id,
      type: entry.type,
      direction: entry.direction,
      escrowId: entry.escrowId,
      auctionId: entry.auctionId,
      amount: Number(entry.amount) || 0,
      currency: 'BDT',
      buyerId: entry.buyerId ?? null,
      sellerId: entry.sellerId ?? null,
      paymentMethod: entry.paymentMethod ?? null,
      providerRef: entry.providerRef ?? null,
      operatorId: entry.operatorId ?? 'system',
      metadata: entry.metadata ?? {},
      createdAt: new Date(),
    });
  } catch (e) {
    log.error('[ledger] recordLedgerEntry failed', e, {
      area: 'escrow',
      severity: 'warning',
      escrowId: entry.escrowId,
      type: entry.type,
    });
  }
}
