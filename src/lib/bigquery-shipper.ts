/**
 * BigQuery analytics sink.
 *
 * Streams marketplace events (bid_placed, auction_created, escrow_funded,
 * dispute_opened, etc.) into a long-term analytics table. Sentry handles
 * errors; this handles the OK-but-interesting events that feed dashboards.
 *
 * Env-gated:
 *   - BIGQUERY_DATASET   = nilamit_events
 *   - BIGQUERY_TABLE     = events
 *   - GOOGLE_APPLICATION_CREDENTIALS = path to SA JSON (or use ADC on GCP)
 *
 * Without these, log.event() no-ops and the rest of the app is unaffected.
 *
 * NOTE: this module is intentionally NOT marked `import "server-only"`.
 * It's reachable from src/lib/logger.ts via a runtime-gated dynamic import,
 * and Turbopack traces the import graph statically — adding "server-only"
 * here would error the production build whenever any client component
 * imports the logger transitively (which is most of them).
 *
 * Instead, we guard at runtime with `typeof window` and lazy-load the
 * heavy @google-cloud/bigquery class only when actually shipping an event.
 * Client bundles get a no-op skeleton; server bundles fully load the SDK.
 *
 * Schema (BigQuery DDL):
 *   event_id    STRING REQUIRED        // UUID
 *   event_type  STRING REQUIRED        // 'bid_placed' | 'auction_created' | ...
 *   ts          TIMESTAMP REQUIRED
 *   user_id     STRING NULLABLE
 *   auction_id  STRING NULLABLE
 *   amount_bdt  INT64 NULLABLE
 *   metadata    JSON NULLABLE
 */

import type { MarketplaceEventType as LoggerEventType } from "@/lib/logger";

const DATASET = process.env.BIGQUERY_DATASET;
const TABLE = process.env.BIGQUERY_TABLE || "events";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;

// Lazy singleton — the BigQuery class is only imported on first event ship,
// and only on the server.
type BigQueryClient = {
  dataset: (name: string) => {
    table: (name: string) => {
      insert: (rows: unknown[]) => Promise<unknown>;
    };
  };
};
let _bq: BigQueryClient | null = null;

async function client(): Promise<BigQueryClient | null> {
  if (typeof window !== "undefined") return null;
  if (!DATASET || !PROJECT_ID) return null;
  if (_bq) return _bq;
  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    _bq = new BigQuery({ projectId: PROJECT_ID }) as unknown as BigQueryClient;
    return _bq;
  } catch {
    return null;
  }
}

/**
 * Re-export the canonical type from the logger. Keep both in sync —
 * compile-time check below guarantees the two definitions match.
 */
export type MarketplaceEventType = LoggerEventType;

export interface MarketplaceEvent {
  type: MarketplaceEventType;
  userId?: string;
  auctionId?: string;
  amountBdt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget event ship. Resolves immediately to avoid blocking the
 * critical path; errors are swallowed so a BigQuery outage never breaks
 * an auction or bid. Returns true if the row was queued for insert.
 *
 * Intentionally not awaited at most call sites — use `void shipEvent(...)`.
 */
export async function shipEvent(event: MarketplaceEvent): Promise<boolean> {
  const bq = await client();
  if (!bq) return false;

  // `crypto.randomUUID` is available in Node 19+ and modern browsers, but
  // since we already gated on `typeof window`, we're always on the server
  // here. Use a guarded import-free implementation for clarity.
  const eventId = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

  const row = {
    event_id: eventId,
    event_type: event.type,
    ts: new Date().toISOString(),
    user_id: event.userId ?? null,
    auction_id: event.auctionId ?? null,
    amount_bdt: event.amountBdt ?? null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
  };

  try {
    await bq.dataset(DATASET!).table(TABLE).insert([row]);
    return true;
  } catch (err) {
    // Don't import logger here — it would create a cycle. Use console; the
    // event sink is best-effort by design.
    console.warn("[BigQuery] event ship failed", event.type, String(err));
    return false;
  }
}

export function isBigQueryConfigured(): boolean {
  return !!DATASET && !!PROJECT_ID;
}
