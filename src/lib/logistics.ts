import 'server-only';

import { db, FieldValue } from '@/lib/db';
import { log } from '@/lib/logger';
import { randomBytes } from 'crypto';
import { bookShipment } from '@/lib/courier';

/**
 * Logistics is implemented as an INTERNAL helper, not a Server Action.
 *
 * Rationale: a `'use server'` export is reachable from the public Server
 * Actions wire endpoint. createLogisticsOrder writes seller/buyer addresses
 * onto a publicly-readable auction document — exposing it would let any
 * caller exfiltrate any user's address by pointing the function at arbitrary
 * IDs. Callers must already be authenticated and inside a verified flow
 * (currently only payEscrowAdvance) and pass the addresses they have already
 * loaded transactionally.
 */

export const LogisticsStatus = {
  PENDING:          'PENDING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  PICKED_UP:        'PICKED_UP',
  IN_TRANSIT:       'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED:        'DELIVERED',
  FAILED:           'FAILED',
} as const;

export type LogisticsStatus = typeof LogisticsStatus[keyof typeof LogisticsStatus];

export interface CreateLogisticsOrderInput {
  auctionId:     string;
  sellerId:      string;
  buyerId:       string;
  sellerAddress: string;
  buyerAddress:  string;
  codAmount?:    number;
  /** Buyer name/phone for the courier booking. Optional — when absent (or the
   *  courier is unconfigured) we fall back to the internal NILAMIT_EXPRESS id. */
  recipientName?:  string | null;
  recipientPhone?: string | null;
}

function newTrackingId(): string {
  // Time prefix keeps IDs roughly sortable; random suffix prevents collisions
  // for orders created in the same millisecond.
  const time   = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `NLM-${time}-${suffix}`;
}

/**
 * Mocks an integration with a local Bangladeshi courier API (Pathao / RedX).
 * Caller is responsible for ensuring the auction id, seller id, and buyer id
 * correspond to the same logical sale and that the addresses are the
 * authoritative ones from the user docs read inside the same transaction.
 *
 * `labelUrl` was removed from the schema because we don't ship a label-fetch
 * endpoint — when a real courier integration lands it should populate
 * `logistics.labelUrl` via the courier's own webhook, not here.
 */
export async function createLogisticsOrder(input: CreateLogisticsOrderInput): Promise<{ trackingId: string }> {
  const trackingId = newTrackingId();
  const now = new Date();

  // Attempt a real courier booking (no-op + null when COURIER_* isn't set, so
  // the default path is unchanged). Never throws — a courier outage falls back
  // to the internal tracking id so escrow settlement is never blocked.
  let provider = 'NILAMIT_EXPRESS';
  let consignmentId: string | null = null;
  let courierTrackingCode: string | null = null;
  if (input.recipientPhone) {
    const booked = await bookShipment({
      invoice:          trackingId,
      recipientName:    input.recipientName || 'Nilamit Buyer',
      recipientPhone:   input.recipientPhone,
      recipientAddress: input.buyerAddress,
      codAmount:        input.codAmount ?? 0,
      note:             `Auction ${input.auctionId}`,
    });
    if (booked) {
      provider = booked.provider;
      consignmentId = booked.consignmentId;
      courierTrackingCode = booked.courierTrackingCode;
    }
  }

  await db.collection('auctions').doc(input.auctionId).update({
    logistics: {
      provider,
      trackingId,
      // Courier-side identifiers (present only on a real booking).
      ...(consignmentId ? { consignmentId } : {}),
      ...(courierTrackingCode ? { courierTrackingCode } : {}),
      status:          LogisticsStatus.READY_FOR_PICKUP,
      pickupAddress:   input.sellerAddress,
      deliveryAddress: input.buyerAddress,
      codAmount:       input.codAmount ?? 0,
      updatedAt:       now,
      history: [
        { status: LogisticsStatus.PENDING,          timestamp: now, note: 'Order created in Nilamit' },
        { status: LogisticsStatus.READY_FOR_PICKUP, timestamp: now, note: courierTrackingCode ? `Booked with ${provider} (${courierTrackingCode})` : 'Awaiting courier pickup' },
      ],
    },
  });

  log.info(`Logistics order created for auction ${input.auctionId}`, { trackingId, provider });
  return { trackingId };
}

/**
 * Append a status event to an auction's logistics.history. Transactional so
 * concurrent updates don't drop history entries.
 *
 * Authorization is the caller's responsibility: this is invoked from admin
 * actions and (in future) signed courier webhooks, never from end-user input.
 */
export async function updateLogisticsStatus(
  auctionId: string,
  status: LogisticsStatus,
  note?: string,
): Promise<void> {
  const aRef = db.collection('auctions').doc(auctionId);
  const now  = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(aRef);
    if (!snap.exists) throw new Error('Auction not found');

    const current = (snap.data()?.logistics ?? {}) as Record<string, unknown>;

    tx.update(aRef, {
      'logistics.status':    status,
      'logistics.updatedAt': now,
      'logistics.history':   FieldValue.arrayUnion({
        status,
        timestamp: now,
        note: note ?? `Status updated to ${status}`,
      }),
      // Preserve other fields (provider/trackingId/...) by not rewriting the parent.
      ...(current.provider ? {} : { 'logistics.provider': 'NILAMIT_EXPRESS' }),
    });
  });
}
