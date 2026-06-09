# Performance posture & the Bangladesh-latency lever

A clear-eyed map of what's cached, what's intentionally *not*, and where the
real latency win is. Written because "add more caching" is the wrong instinct
for a live-auction marketplace — stale prices are worse than slow ones.

## What's already cached (data layer)

| Path | Mechanism | TTL |
|---|---|---|
| Listings (`getAuctions`) | `unstable_cache`, tag `auctions` | 60s |
| Homepage stats | `unstable_cache`, tag `stats` | 300s |
| System config | `unstable_cache`, tag `config` | 3600s |
| Homepage feeds (`getSpecializedFeeds`) | `unstable_cache` + React `cache` | per build/tag |
| Marketing pages (faq, terms, how-it-works, …) | static (no dynamic APIs) | build-time |

Writes call `revalidatePath('/')`, `'/auctions'`, etc., so cache invalidation is
already wired to mutations.

## What is intentionally NOT cached

- **Auction detail (`/auctions/[id]`)** and **listings pages** are
  `force-dynamic`. This is correct: `currentPrice`, `bidCount`, and `endTime`
  change in real time during bidding. Caching the page would show stale bids —
  a correctness bug far worse than latency. Do **not** add ISR here.
- Per-user bits (watchlist flags, seller-vs-public view) are request-scoped by
  design (see PII gating, CLAUDE.md rule 11).

So the caching strategy is already appropriate. More page caching is not the win.

## The real lever: data locality

Firestore `(default)` is **`nam5` (US)**; users are in **Bangladesh**. For the
`force-dynamic` paths, TTFB is dominated by the App-Hosting↔Firestore↔user
round trips across the Pacific. That's the dominant latency source, and it's a
*placement* problem, not a caching one.

**Measure before moving anything.** RUM (`web_vital` events → BigQuery) now
captures connection class (`effectiveType`). Run query #8 in
`LOOKER_QUERIES.sql`:

> If p75 **TTFB** is high even on `4g` connections, the bottleneck is
> server/data distance — not the user's network. That quantifies the locality
> problem and, after a fix, proves the impact.

Options, cheapest-first:
1. **Co-locate compute** — ensure the App Hosting backend region is the closest
   GCP region to BD (Mumbai `asia-south1` / Singapore `asia-southeast1`). Reduces
   the compute↔user leg even while Firestore stays in US.
2. **Search engine in-region** (already designed — see `SEARCH.md`): the hottest
   read path (keyword search) served from Mumbai is closer to users than
   Firestore itself.
3. **Read-path cache layer** for hot, non-real-time reads (seller profiles,
   category facets) via Upstash (already in the stack) close to compute.
4. **Firestore multi-region / a regional secondary** — biggest move, only worth
   it once #1–3 are done and RUM still shows a locality tax. Migrating the
   default DB region is non-trivial; treat as a project, not a tweak.

## RUM dashboard

Already built — `LOOKER_QUERIES.sql` (web-vitals p75 by route, session summary,
and now TTFB-by-connection) + `LOOKER_DASHBOARD.md` for setup. The work here was
to make the data-locality question *answerable*, which query #8 now does.
