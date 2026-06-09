/**
 * External search engine adapter (Typesense).
 *
 * WHY THIS EXISTS
 * ───────────────
 * Firestore has no native substring/relevance search. The legacy path in
 * `AuctionReader.list` scans the first ~1000 docs ordered by endTime and
 * substring-matches in memory — which silently returns nothing for matches
 * past the scan cap and costs up to 1000 reads per keyword query. That is a
 * hard ceiling for a marketplace whose core loop IS search.
 *
 * This module fronts a real search engine (Typesense — open-source, cheap to
 * self-host in-region for Bangladesh latency). Firestore stays the source of
 * truth: we index a thin projection of each auction here, query it for the
 * matching *ids*, then hydrate the full docs from Firestore. So price/bidCount
 * are always authoritative even if the index lags by a few seconds.
 *
 * ENV-GATED (matches the pubsub.ts pattern):
 *   TYPESENSE_HOST        e.g. "search.nilamit.internal" or a Typesense Cloud host
 *   TYPESENSE_API_KEY     a search/admin key
 *   TYPESENSE_PROTOCOL    "https" (default) | "http"
 *   TYPESENSE_PORT        default 443
 *   TYPESENSE_COLLECTION  default "auctions"
 *
 * Without TYPESENSE_HOST + TYPESENSE_API_KEY every export no-ops and the
 * reader transparently falls back to the legacy in-memory scan. Nothing
 * breaks before the engine is provisioned.
 *
 * Implemented over the REST API with `fetch` on purpose — no new npm
 * dependency to add to the manually-patched lockfile, and no cold-start cost
 * from a heavy client.
 */

import 'server-only';
import { log } from '@/lib/logger';

const HOST = process.env.TYPESENSE_HOST;
const API_KEY = process.env.TYPESENSE_API_KEY;
const PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'https';
const PORT = process.env.TYPESENSE_PORT || '443';
const COLLECTION = process.env.TYPESENSE_COLLECTION || 'auctions';

export function isSearchEngineConfigured(): boolean {
  return !!HOST && !!API_KEY;
}

function baseUrl(): string {
  return `${PROTOCOL}://${HOST}:${PORT}`;
}

/**
 * The document we index. Deliberately thin — only what's needed to match and
 * sort. Everything displayed comes from the Firestore hydrate step. Dates are
 * stored as unix-seconds int64 so Typesense can range-filter/sort on them.
 */
export interface AuctionSearchDoc {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  condition: string;
  status: string;
  sellerId: string;
  currentPrice: number;
  bidCount: number;
  isFeatured: boolean;
  endTime: number; // unix seconds
  createdAt: number; // unix seconds
}

function toUnixSeconds(v: unknown): number {
  if (!v) return 0;
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === 'object' && v !== null && 'toDate' in v) {
    const d = (v as { toDate?: () => Date }).toDate?.();
    if (d) return Math.floor(d.getTime() / 1000);
  }
  const t = new Date(v as string | number).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

/** Project an auction (Firestore shape) into the search document. */
export function toSearchDoc(a: Record<string, unknown>): AuctionSearchDoc {
  return {
    id: String(a.id),
    title: String(a.title ?? ''),
    description: String(a.description ?? ''),
    category: String(a.category ?? ''),
    location: String(a.location ?? ''),
    condition: String(a.condition ?? ''),
    status: String(a.status ?? ''),
    sellerId: String(a.sellerId ?? ''),
    currentPrice: Number(a.currentPrice ?? 0),
    bidCount: Number(a.bidCount ?? 0),
    isFeatured: Boolean(a.isFeatured),
    endTime: toUnixSeconds(a.endTime),
    createdAt: toUnixSeconds(a.createdAt),
  };
}

async function ts(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 4000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY as string,
        'Content-Type': 'application/json',
        ...(rest.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The Typesense collection schema. Run once (idempotent) before the first
 * backfill — `scripts/backfill-search.ts` calls this.
 */
export const COLLECTION_SCHEMA = {
  name: COLLECTION,
  // The first sort-default field must be numeric; we use createdAt.
  default_sorting_field: 'createdAt',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'location', type: 'string', facet: true },
    { name: 'condition', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'sellerId', type: 'string' },
    { name: 'currentPrice', type: 'int64' },
    { name: 'bidCount', type: 'int32' },
    { name: 'isFeatured', type: 'bool', facet: true },
    { name: 'endTime', type: 'int64' },
    { name: 'createdAt', type: 'int64' },
  ],
} as const;

/** Create the collection if it doesn't exist. Idempotent. */
export async function ensureCollection(): Promise<boolean> {
  if (!isSearchEngineConfigured()) return false;
  try {
    const existing = await ts(`/collections/${COLLECTION}`, { method: 'GET' });
    if (existing.ok) return true;
    const res = await ts('/collections', {
      method: 'POST',
      body: JSON.stringify(COLLECTION_SCHEMA),
    });
    return res.ok || res.status === 409; // 409 == already exists (race)
  } catch (err) {
    log.warn('[search] ensureCollection failed', { error: String(err) });
    return false;
  }
}

/**
 * Upsert one auction into the index. Fire-and-forget from write paths —
 * failures are logged, never thrown, so a search-engine blip can't fail a
 * listing creation.
 */
export async function indexAuction(auction: Record<string, unknown>): Promise<boolean> {
  if (!isSearchEngineConfigured()) return false;
  try {
    const doc = toSearchDoc(auction);
    const res = await ts(`/collections/${COLLECTION}/documents?action=upsert`, {
      method: 'POST',
      body: JSON.stringify(doc),
    });
    if (!res.ok) log.warn('[search] indexAuction non-ok', { id: doc.id, status: res.status });
    return res.ok;
  } catch (err) {
    log.warn('[search] indexAuction failed', { error: String(err) });
    return false;
  }
}

/**
 * Partial-update a subset of an indexed auction's fields (Typesense PATCH).
 * Used on close to flip `status` so SOLD/EXPIRED listings drop out of ACTIVE
 * search results without re-sending the whole document.
 */
export async function updateAuctionInIndex(
  id: string,
  partial: Partial<AuctionSearchDoc>,
): Promise<boolean> {
  if (!isSearchEngineConfigured()) return false;
  try {
    const res = await ts(`/collections/${COLLECTION}/documents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    });
    return res.ok || res.status === 404;
  } catch (err) {
    log.warn('[search] updateAuctionInIndex failed', { id, error: String(err) });
    return false;
  }
}

/** Remove an auction from the index (on hard-delete / gc). */
export async function removeAuctionFromIndex(id: string): Promise<boolean> {
  if (!isSearchEngineConfigured()) return false;
  try {
    const res = await ts(`/collections/${COLLECTION}/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok || res.status === 404;
  } catch (err) {
    log.warn('[search] removeAuctionFromIndex failed', { id, error: String(err) });
    return false;
  }
}

/**
 * Liveness ping for the search node (Typesense `/health`). Returns:
 *   'disabled' — engine not configured (expected before provisioning)
 *   'ok'       — node reachable and healthy
 *   'error'    — configured but unreachable/unhealthy
 *
 * Surfaced in /api/health as an advisory signal. Search degrades gracefully
 * (falls back to the in-memory scan) when the node is down, so this should NOT
 * gate overall health to 503 — it's an alert trigger, not an outage.
 */
export async function pingSearchEngine(): Promise<'ok' | 'error' | 'disabled'> {
  if (!isSearchEngineConfigured()) return 'disabled';
  try {
    const res = await ts('/health', { method: 'GET', timeoutMs: 2000 });
    if (!res.ok) return 'error';
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return data.ok === true ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export interface SearchParams {
  query: string;
  status?: string;
  category?: string;
  location?: string;
  condition?: string;
  isFeatured?: boolean;
  sortBy?: 'endTime' | 'currentPrice' | 'createdAt' | 'bidCount';
  sortOrder?: 'asc' | 'desc';
  page?: number; // 1-based
  perPage?: number;
}

export interface SearchResult {
  ids: string[];
  total: number;
}

/**
 * Run a keyword search. Returns matching auction *ids* in ranked order plus a
 * total count. The caller hydrates the full docs from Firestore. Returns null
 * if the engine isn't configured (signals the caller to use the fallback).
 */
export async function searchAuctions(params: SearchParams): Promise<SearchResult | null> {
  if (!isSearchEngineConfigured()) return null;

  const filterClauses: string[] = [];
  if (params.status) filterClauses.push(`status:=${params.status}`);
  if (params.category && params.category !== 'all') filterClauses.push(`category:=${params.category}`);
  if (params.location && params.location !== 'all') filterClauses.push(`location:=${params.location}`);
  if (params.condition) filterClauses.push(`condition:=${params.condition}`);
  if (params.isFeatured) filterClauses.push(`isFeatured:=true`);

  const sortField = params.sortBy ?? 'createdAt';
  const sortOrder = params.sortOrder ?? 'desc';

  const qs = new URLSearchParams({
    q: params.query,
    query_by: 'title,description',
    // Weight title over description so a title hit ranks higher.
    query_by_weights: '2,1',
    // Typo tolerance scales with word length — forgives BD-English spelling.
    num_typos: '2',
    page: String(params.page ?? 1),
    per_page: String(params.perPage ?? 12),
    sort_by: `_text_match:desc,${sortField}:${sortOrder}`,
    include_fields: 'id',
  });
  if (filterClauses.length) qs.set('filter_by', filterClauses.join(' && '));

  try {
    const res = await ts(`/collections/${COLLECTION}/documents/search?${qs.toString()}`, {
      method: 'GET',
    });
    if (!res.ok) {
      log.warn('[search] searchAuctions non-ok', { status: res.status });
      return null; // fall back to scan on engine error
    }
    const data = (await res.json()) as {
      found?: number;
      hits?: Array<{ document?: { id?: string } }>;
    };
    const ids = (data.hits ?? [])
      .map((h) => h.document?.id)
      .filter((x): x is string => typeof x === 'string');
    return { ids, total: data.found ?? ids.length };
  } catch (err) {
    log.warn('[search] searchAuctions failed', { error: String(err) });
    return null;
  }
}
