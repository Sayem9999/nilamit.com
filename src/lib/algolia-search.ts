/**
 * Algolia search client — server-side read path.
 *
 * Cloud Functions (functions/src/index.ts) already mirror auction writes
 * into the `auctions` Algolia index. This module provides the read side
 * for /actions/search.ts: typo-tolerant, multi-filter search.
 *
 * Env-gated: if ALGOLIA_APP_ID or ALGOLIA_SEARCH_KEY is missing we return
 * `null` and the caller falls back to Firestore prefix search. Production
 * deployments should set both secrets to get the typo-tolerant experience;
 * dev/local works fine without.
 *
 * Use the *search-only* key here, not the admin key. The admin key has write
 * permissions and must never leave the build environment.
 */

import { algoliasearch, type SearchClient } from "algoliasearch";
import { log } from "@/lib/logger";

const APP_ID = process.env.ALGOLIA_APP_ID;
const SEARCH_KEY = process.env.ALGOLIA_SEARCH_KEY;
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "auctions";

let _client: SearchClient | null = null;

function getClient(): SearchClient | null {
  if (!APP_ID || !SEARCH_KEY) return null;
  if (!_client) _client = algoliasearch(APP_ID, SEARCH_KEY);
  return _client;
}

export interface AlgoliaAuctionHit {
  objectID: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  condition?: string;
  currentPrice: number;
  startingPrice: number;
  bidCount?: number;
  status: string;
  sellerId: string;
  endTime: number; // unix ms
  images?: string[];
  isFeatured?: boolean;
}

export interface AlgoliaSearchParams {
  query: string;
  category?: string;
  location?: string;
  condition?: string;
  hitsPerPage?: number;
  page?: number;
}

export interface AlgoliaSearchResult {
  hits: AlgoliaAuctionHit[];
  nbHits: number;
  page: number;
  nbPages: number;
}

/**
 * Run a typo-tolerant search. Returns null if Algolia isn't configured —
 * callers should fall back to a Firestore query in that case.
 */
export async function searchAuctions(
  params: AlgoliaSearchParams,
): Promise<AlgoliaSearchResult | null> {
  const client = getClient();
  if (!client) return null;

  const filters: string[] = ["status:ACTIVE"];
  if (params.category && params.category !== "all") {
    filters.push(`category:${params.category}`);
  }
  if (params.location && params.location !== "all") {
    filters.push(`location:${params.location}`);
  }
  if (params.condition && params.condition !== "all") {
    filters.push(`condition:${params.condition}`);
  }

  try {
    const { results } = await client.search<AlgoliaAuctionHit>({
      requests: [
        {
          indexName: INDEX_NAME,
          query: params.query,
          filters: filters.join(" AND "),
          hitsPerPage: params.hitsPerPage ?? 20,
          page: params.page ?? 0,
          typoTolerance: true,
        },
      ],
    });

    const first = results[0];
    if (!first || !("hits" in first)) return null;
    return {
      hits: first.hits as AlgoliaAuctionHit[],
      nbHits: first.nbHits ?? 0,
      page: first.page ?? 0,
      nbPages: first.nbPages ?? 1,
    };
  } catch (err) {
    log.warn("[Algolia] search failed — caller will fall back to Firestore", { error: String(err) });
    return null;
  }
}

/** True iff Algolia env vars are configured. */
export function isAlgoliaConfigured(): boolean {
  return !!APP_ID && !!SEARCH_KEY;
}
