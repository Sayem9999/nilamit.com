/**
 * POST /api/cron/saved-search-matches
 *
 * For every active saved search, re-run its filter query against auctions
 * created since the saved search's `lastCheckedAt` (or, for first-time
 * runs, against all ACTIVE auctions in the last 24h). For each new match,
 * fire a notify() through the user's preferred channels.
 *
 * Schedule: every 15 minutes via GitHub Actions cron (see
 * .github/workflows/cron.yml — add the entry). At that cadence, users
 * get a near-real-time alert without the system hammering Firestore.
 *
 * Cost shape: O(activeSavedSearches × matchesPerSearch). With current
 * defaults (50 saved searches per user, matchCount cap 100 per match
 * batch) we cap at ~5k notify() calls per cron tick which is fine.
 *
 * Idempotency: lastCheckedAt advances on every successful pass; if we
 * fail mid-batch and re-run, only newer auctions are re-considered (older
 * ones are below the threshold). Worst case is a duplicate notification.
 */

import { NextResponse } from 'next/server';
import { verifyCronSecret, cronSuccess, cronError } from '@/lib/cron-utils';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { notify } from '@/lib/notification-channels';
import { recordSavedSearchMatch, type SavedSearch } from '@/actions/saved-search';
import type { Auction } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Max new auctions to consider per saved search per run. Cap on cost. */
const MAX_MATCHES_PER_SEARCH = 25;

/** Max saved searches to process in one tick. Anything above is deferred. */
const MAX_SEARCHES_PER_TICK = 500;

/** First-run lookback: how far back to scan when lastCheckedAt is unset. */
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const startedAt = Date.now();
  try {
    // Pull saved searches sorted by stalest first — guarantees fair
    // coverage when the queue exceeds MAX_SEARCHES_PER_TICK.
    const snap = await db
      .collection('savedSearches')
      .orderBy('lastCheckedAt', 'asc')
      .limit(MAX_SEARCHES_PER_TICK)
      .get();

    if (snap.empty) {
      return cronSuccess({ processed: 0, matches: 0, durationMs: Date.now() - startedAt });
    }

    let totalProcessed = 0;
    let totalMatches = 0;

    for (const doc of snap.docs) {
      const saved = doc.data() as SavedSearch & {
        lastCheckedAt?: { toDate?: () => Date };
      };

      const lastChecked =
        saved.lastCheckedAt?.toDate?.() ??
        new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);

      try {
        const matches = await findMatchingAuctions(saved.filters, lastChecked);
        const capped = matches.slice(0, MAX_MATCHES_PER_SEARCH);

        if (capped.length > 0) {
          await fireNotifications(saved, capped);
        }

        // Always record the pass so lastCheckedAt advances — prevents
        // forever-stale searches from monopolising future ticks.
        await recordSavedSearchMatch(saved.id, capped.length);

        totalProcessed++;
        totalMatches += capped.length;
      } catch (err) {
        log.warn('[Cron:saved-search] per-search failure (continuing)', {
          searchId: saved.id,
          error: String(err),
        });
      }
    }

    log.info('[Cron:saved-search] complete', {
      processed: totalProcessed,
      matches: totalMatches,
      durationMs: Date.now() - startedAt,
    });

    return cronSuccess({
      processed: totalProcessed,
      matches: totalMatches,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    log.error('[Cron:saved-search] top-level failure', err, {
      area: 'cron',
      severity: 'warning',
    });
    return cronError(err instanceof Error ? err.message : 'Saved-search cron failed');
  }
}

// ────────────────────────────────────────────────────────────────────
// Matching
// ────────────────────────────────────────────────────────────────────

interface SavedFilters {
  search?: string;
  category?: string;
  location?: string;
  condition?: 'NEW' | 'USED' | 'REFURBISHED';
  minPrice?: number;
  maxPrice?: number;
}

interface MatchedAuction {
  id: string;
  title: string;
  currentPrice: number;
  category?: string | null;
  location?: string | null;
}

/**
 * Run the saved filter against auctions created after `since`. We do an
 * indexed query on category + status + createdAt (matching the existing
 * composite indexes used by /actions/auction.ts), then in-memory-filter
 * the rest because they're sparse fields.
 */
async function findMatchingAuctions(
  filters: SavedFilters,
  since: Date,
): Promise<MatchedAuction[]> {
  let query = db
    .collection('auctions')
    .where('status', '==', 'ACTIVE')
    .where('createdAt', '>', since);

  // Push down high-cardinality filters into the query so Firestore handles
  // them. The rest filter in memory.
  if (filters.category) {
    query = query.where('category', '==', filters.category);
  }
  if (filters.location) {
    query = query.where('location', '==', filters.location);
  }

  const snap = await query.orderBy('createdAt', 'desc').limit(200).get();
  if (snap.empty) return [];

  const q = filters.search?.toLowerCase().trim();
  const cond = filters.condition;

  return snap.docs
    .map((d) => {
      const a = d.data() as Auction;
      return { ...a, id: d.id } as Auction & { id: string };
    })
    .filter((a) => {
      // In-memory keyword match on title — Firestore can't do contains.
      if (q && !((a.title ?? '').toLowerCase().includes(q))) return false;
      if (cond && a.condition !== cond) return false;
      if (filters.minPrice && a.currentPrice < filters.minPrice) return false;
      if (filters.maxPrice && a.currentPrice > filters.maxPrice) return false;
      return true;
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      currentPrice: a.currentPrice,
      category: a.category ?? null,
      location: a.location ?? null,
    }));
}

// ────────────────────────────────────────────────────────────────────
// Notification fan-out
// ────────────────────────────────────────────────────────────────────

async function fireNotifications(
  saved: SavedSearch,
  matches: MatchedAuction[],
): Promise<void> {
  // Aggregate notification — don't spam the user with N separate pings.
  // "3 new matches for 'iPhone in Dhaka'" feels much better than 3 pings.
  const first = matches[0];
  const more = matches.length > 1 ? ` and ${matches.length - 1} more` : '';
  const body =
    matches.length === 1
      ? `${first.title} — ৳${first.currentPrice.toLocaleString()}`
      : `${first.title} — ৳${first.currentPrice.toLocaleString()}${more}`;

  await notify(saved.userId, {
    type: 'saved_search_match',
    title: `New match: ${saved.label}`,
    body,
    clickUrl: `/auctions/${matches[0].id}`,
    data: {
      savedSearchId: saved.id,
      matchCount: String(matches.length),
    },
  });
}

// GET is intentionally not supported — cron endpoints must be POST so
// HTTP infrastructure (caches / browsers / link previews) can't fire them.
export function GET() {
  return NextResponse.json(
    { error: 'Use POST with Authorization: Bearer <CRON_SECRET>' },
    { status: 405 },
  );
}
