/**
 * Courier integration — one-click shipment booking + status tracking with a
 * Bangladeshi courier (Steadfast as the first concrete provider; the shape
 * generalizes to Pathao / RedX behind COURIER_PROVIDER).
 *
 * ENV-GATED (same pattern as search-engine.ts / sslcommerz.ts): without
 * `COURIER_API_KEY` + `COURIER_SECRET_KEY` this no-ops and createLogisticsOrder
 * keeps using the internal NILAMIT_EXPRESS tracking id — today's behavior is
 * unchanged. Set the secrets to switch on real booking; no code change.
 *
 *   COURIER_PROVIDER     "steadfast" (default) | future: "pathao" | "redx"
 *   COURIER_API_KEY      merchant api key
 *   COURIER_SECRET_KEY   merchant secret key
 *   COURIER_BASE_URL     override host (default: Steadfast prod)
 *   COURIER_WEBHOOK_SECRET  shared secret the courier sends to /api/courier/webhook
 *
 * Status updates flow back via /api/courier/webhook → updateLogisticsStatus.
 */

import 'server-only';
import { log } from '@/lib/logger';
// Type-only import — avoids a runtime cycle with logistics.ts (which imports
// bookShipment from here). We return the status string literals directly.
import type { LogisticsStatus } from '@/lib/logistics';

const PROVIDER = process.env.COURIER_PROVIDER || 'steadfast';
const API_KEY = process.env.COURIER_API_KEY;
const SECRET_KEY = process.env.COURIER_SECRET_KEY;
const BASE_URL = process.env.COURIER_BASE_URL || 'https://portal.steadfast.com.bd/api/v1';

export function isCourierConfigured(): boolean {
  return !!API_KEY && !!SECRET_KEY;
}

export interface BookShipmentInput {
  /** Our internal reference (the NLM tracking id) — sent as the courier invoice. */
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  note?: string;
}

export interface BookedShipment {
  provider: string;
  /** Courier-side human tracking code shown to the buyer. */
  courierTrackingCode: string;
  /** Courier-side consignment id used for status polling. */
  consignmentId: string;
}

/**
 * Map a raw courier delivery status to our LogisticsStatus enum. Pure +
 * exported so it's unit-testable without hitting the network. Unknown values
 * fall back to IN_TRANSIT (a safe "moving" state) rather than throwing.
 */
export function mapCourierStatus(raw: string | undefined | null): LogisticsStatus {
  switch ((raw || '').toLowerCase()) {
    case 'pending':
    case 'in_review':
      return 'READY_FOR_PICKUP';
    case 'picked':
    case 'picked_up':
      return 'PICKED_UP';
    case 'in_transit':
    case 'shipped':
      return 'IN_TRANSIT';
    case 'out_for_delivery':
      return 'OUT_FOR_DELIVERY';
    case 'delivered':
    case 'partial_delivered':
      return 'DELIVERED';
    case 'cancelled':
    case 'returned':
    case 'delivery_failed':
      return 'FAILED';
    default:
      return 'IN_TRANSIT';
  }
}

function headers(): Record<string, string> {
  return {
    'Api-Key': API_KEY as string,
    'Secret-Key': SECRET_KEY as string,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Book a shipment with the courier. Returns null if the courier isn't
 * configured (caller falls back to internal tracking) or on any failure —
 * never throws, so a courier outage can't fail the escrow settlement.
 */
export async function bookShipment(input: BookShipmentInput): Promise<BookedShipment | null> {
  if (!isCourierConfigured()) return null;
  if (PROVIDER !== 'steadfast') {
    log.warn('[courier] provider not implemented yet', { provider: PROVIDER });
    return null;
  }

  try {
    const res = await fetch(`${BASE_URL}/create_order`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        invoice: input.invoice,
        recipient_name: input.recipientName.slice(0, 100),
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress.slice(0, 250),
        cod_amount: Math.max(0, Math.round(input.codAmount)),
        note: (input.note || 'Nilamit order').slice(0, 200),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      log.error('[courier] create_order HTTP error', { status: res.status, invoice: input.invoice, area: 'logistics', severity: 'warning' });
      return null;
    }

    const data = (await res.json()) as {
      status?: number;
      consignment?: { consignment_id?: number | string; tracking_code?: string };
    };

    const c = data.consignment;
    if (data.status !== 200 || !c?.consignment_id || !c?.tracking_code) {
      log.error('[courier] create_order rejected', { invoice: input.invoice, status: data.status, area: 'logistics', severity: 'warning' });
      return null;
    }

    return {
      provider: PROVIDER,
      courierTrackingCode: String(c.tracking_code),
      consignmentId: String(c.consignment_id),
    };
  } catch (err) {
    log.error('[courier] booking failed', err, { invoice: input.invoice, area: 'logistics', severity: 'warning' });
    return null;
  }
}

/**
 * Poll a consignment's current status. Returns the mapped LogisticsStatus, or
 * null on failure. Used as a fallback when webhooks aren't configured.
 */
export async function getShipmentStatus(consignmentId: string): Promise<LogisticsStatus | null> {
  if (!isCourierConfigured() || PROVIDER !== 'steadfast') return null;
  try {
    const res = await fetch(`${BASE_URL}/status_by_cid/${encodeURIComponent(consignmentId)}`, {
      method: 'GET',
      headers: headers(),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { delivery_status?: string };
    return mapCourierStatus(data.delivery_status);
  } catch (err) {
    log.warn('[courier] status poll failed', { consignmentId, error: String(err) });
    return null;
  }
}

export function isCourierWebhookSecretValid(provided: string | null | undefined): boolean {
  const expected = process.env.COURIER_WEBHOOK_SECRET;
  return !!expected && typeof provided === 'string' && provided === expected;
}
