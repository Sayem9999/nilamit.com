/**
 * One-shot (and re-runnable) backfill: index every existing auction into the
 * Typesense search engine.
 *
 * WHY: `src/lib/search-engine.ts` indexes auctions going forward (on create /
 * close), but auctions that already exist in Firestore when you provision the
 * engine won't be in the index until they next change. This script seeds the
 * collection from the current Firestore state so search returns everything
 * from day one.
 *
 * It also PRUNES: any auction whose Firestore status is terminal
 * (SOLD/EXPIRED/CANCELLED) is still indexed (with its real status) so the
 * reader's self-healing status filter keeps results correct.
 *
 * USAGE (after setting the env below — same vars the app reads):
 *   TYPESENSE_HOST=... TYPESENSE_API_KEY=... npx tsx scripts/backfill-search.ts
 *
 * Idempotent: uses upsert, so re-running just refreshes the index. Safe to run
 * on a schedule as a reconciliation job if you ever suspect index drift.
 *
 * Self-contained on purpose: it does NOT import src/lib/search-engine.ts
 * (which is `server-only` and throws outside Next). It hits the Typesense REST
 * API directly with the same env contract.
 */

import { db } from '../src/lib/db';

const HOST = process.env.TYPESENSE_HOST;
const API_KEY = process.env.TYPESENSE_API_KEY;
const PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'https';
const PORT = process.env.TYPESENSE_PORT || '443';
const COLLECTION = process.env.TYPESENSE_COLLECTION || 'auctions';

const BASE = `${PROTOCOL}://${HOST}:${PORT}`;

const SCHEMA = {
  name: COLLECTION,
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
};

function ts(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY as string,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function toUnixSeconds(v: unknown): number {
  if (!v) return 0;
  const d = (v as { toDate?: () => Date })?.toDate ? (v as { toDate: () => Date }).toDate() : new Date(v as string | number);
  const t = d.getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

function toDoc(id: string, a: Record<string, unknown>) {
  return {
    id,
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

async function ensureCollection() {
  const existing = await ts(`/collections/${COLLECTION}`, { method: 'GET' });
  if (existing.ok) {
    console.log(`[backfill] collection "${COLLECTION}" already exists`);
    return;
  }
  const res = await ts('/collections', { method: 'POST', body: JSON.stringify(SCHEMA) });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to create collection: ${res.status} ${await res.text()}`);
  }
  console.log(`[backfill] created collection "${COLLECTION}"`);
}

async function main() {
  if (!HOST || !API_KEY) {
    console.error('TYPESENSE_HOST and TYPESENSE_API_KEY must be set. Aborting.');
    process.exit(1);
  }

  await ensureCollection();

  const PAGE = 500;
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let indexed = 0;

  // Page through the whole auctions collection ordered by document id (stable,
  // index-free cursor). Bulk-import each page as JSONL via the documents/import
  // endpoint (one HTTP round-trip per 500 docs).
  for (;;) {
    let q = db.collection('auctions').orderBy('__name__').limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const jsonl = snap.docs.map((d) => JSON.stringify(toDoc(d.id, d.data()))).join('\n');
    const res = await ts(`/collections/${COLLECTION}/documents/import?action=upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: jsonl,
    });
    if (!res.ok) {
      throw new Error(`Import failed: ${res.status} ${await res.text()}`);
    }
    // Typesense returns one JSON status line per doc; count failures.
    const lines = (await res.text()).split('\n').filter(Boolean);
    const failures = lines.filter((l) => !l.includes('"success":true')).length;
    indexed += snap.docs.length - failures;
    if (failures) console.warn(`[backfill] ${failures} docs failed in this page`);

    last = snap.docs[snap.docs.length - 1];
    console.log(`[backfill] indexed ${indexed} auctions so far...`);
    if (snap.docs.length < PAGE) break;
  }

  console.log(`[backfill] DONE — ${indexed} auctions indexed into "${COLLECTION}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] FAILED', err);
  process.exit(1);
});
