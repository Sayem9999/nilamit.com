# Search — external engine migration (Typesense)

## Why

Firestore has no native substring or relevance search. The legacy path in
[`AuctionReader.list`](../src/services/auction/modules/auction-reader.ts) scans
the first **1,000** ACTIVE auctions ordered by `endTime` and substring-matches
`title`/`description` **in memory**. Two consequences at scale:

1. **Correctness ceiling** — a match past listing #1,000 silently returns
   nothing. Items become invisible the moment the catalog passes ~1k actives.
2. **Cost/latency** — every keyword query reads up to 1,000 docs.

For a marketplace whose core loop *is* search, that's the hard ceiling. This
migration fronts a real engine (Typesense) while keeping **Firestore as the
source of truth**.

## Design

```
Write path (create / close)         Read path (keyword search)
─────────────────────────           ──────────────────────────
AuctionWriter.create ──┐            AuctionReader.list
auction-logic close ───┼─► index    │  searchAuctions() → ranked ids
                       │            │  db.getAll(ids)    → hydrate full docs (truth)
        Typesense  ◄───┘            │  re-filter status  → self-healing
        (thin projection)           └─ return AuctionWithSeller[]
```

- We index a **thin projection** (`AuctionSearchDoc`) — only what's needed to
  match/sort. Everything displayed is hydrated from Firestore, so
  `currentPrice`/`bidCount` are never stale.
- The engine returns ranked **ids**; the reader hydrates from Firestore and
  **re-asserts the requested status**. So a stale index entry (e.g. an auction
  CANCELLED by admin that didn't reindex) is *harmless* (filtered out), never
  *wrong* (shown as ACTIVE).
- **Env-gated** ([`search-engine.ts`](../src/lib/search-engine.ts)): without
  `TYPESENSE_HOST` + `TYPESENSE_API_KEY`, every export no-ops and the reader
  transparently uses the legacy scan. Nothing breaks before provisioning.
- Implemented over the REST API with `fetch` — **no new npm dependency** (keeps
  the manually-patched lockfile clean) and no heavy-client cold start.

## Pagination

The engine is page-based; the public API is cursor (`lastId`)-based. The reader
emits an **opaque `p:{page}` cursor** that the client round-trips verbatim
([`LoadMore.tsx`](../src/components/auction/LoadMore.tsx) treats `lastId` as
opaque), so no client change is needed. Non-keyword listing queries keep using
real document-id cursors via the standard Firestore path.

## Document schema (Typesense collection `auctions`)

| field | type | notes |
|---|---|---|
| `id` | (doc id) | = Firestore auction id |
| `title` | string | `query_by` weight 2 |
| `description` | string | `query_by` weight 1 |
| `category`, `location`, `condition`, `status` | string (facet) | filters |
| `isFeatured` | bool (facet) | filter |
| `sellerId` | string | |
| `currentPrice` | int64 | sort/filter |
| `bidCount` | int32 | sort |
| `endTime`, `createdAt` | int64 (unix s) | sort/filter; `createdAt` is default sort |

Ranking: `sort_by=_text_match:desc,{sortField}:{order}` with `num_typos=2`.

## Activation runbook

1. **Provision Typesense** in-region (Singapore / Mumbai for BD latency) — a
   single node is fine to start (Typesense Cloud, or self-host on Cloud Run /
   a small VM). Note the host + an **admin API key**.
2. **Set secrets** on the App Hosting backend:
   ```bash
   firebase apphosting:secrets:set TYPESENSE_API_KEY --project nilamit-52073 --data-file -
   firebase apphosting:secrets:grantaccess TYPESENSE_API_KEY --project nilamit-52073 --backend nilamit
   ```
   and add `TYPESENSE_HOST` (+ optional `TYPESENSE_PROTOCOL`/`TYPESENSE_PORT`/
   `TYPESENSE_COLLECTION`) to `apphosting.yaml` env.
3. **Backfill** the existing catalog (creates the collection if missing):
   ```bash
   TYPESENSE_HOST=... TYPESENSE_API_KEY=... npx tsx scripts/backfill-search.ts
   ```
   Idempotent (upsert) — safe to re-run as a reconciliation job.
4. **Deploy.** New listings index on create; closed listings reindex their
   terminal status automatically.
5. **Verify**: search a term you know exists past the 1,000th active listing —
   it should now return. Disable the engine (unset env) any time to fall back
   to the scan with zero code change.

## Hosting: Typesense Cloud vs self-host (Bangladesh)

> Ballpark figures — **verify against current vendor pricing before committing.**
> Typesense Cloud bills hourly by RAM/CPU; GCP bills by instance + disk.

Latency context: Firestore `(default)` is `nam5` (US). Putting the search
engine **in-region (Mumbai `asia-south1` or Singapore `asia-southeast1`)** makes
keyword search *closer to BD users than Firestore itself is* — a real win,
since search is the hottest read path.

| Factor | Typesense Cloud | Self-host (GCP, in-region) |
|---|---|---|
| **Single-node cost** | ~$0.03–0.10/hr ≈ **$25–75/mo** (0.5–2 GB RAM tier) | **e2-small ~$13/mo** or e2-medium ~$27/mo + ~$2/mo disk |
| **High availability (3 nodes)** | **~3× single-node** (~$75–220/mo) | 3× instances + you wire the cluster yourself |
| **Region near BD** | Mumbai + Singapore available | Mumbai/Singapore both available |
| **Ops burden** | Zero — managed upgrades, snapshots, failover | You own upgrades, snapshots, monitoring, restarts |
| **Bandwidth** | Metered extra | Egress within-region cheap; same-VPC ~free |
| **Time to live** | Minutes (provision + API key) | ~1–2 hrs (VM + binary + systemd + snapshot cron) |
| **Lock-in** | Low — same REST API as self-host | None |

**Recommendation for nilamit's current stage (bootstrapped, < ~100k active
listings):** start **self-hosted, single node, e2-small in `asia-south1`
(Mumbai)**. Cheapest, lowest BD latency, and Typesense is operationally trivial
(one Go binary, on-disk snapshots). Because the app talks to it over the plain
REST API, **migrating to Typesense Cloud later is a host + key swap — zero code
change.** Move to Cloud (or self-managed 3-node HA) only once search is
revenue-critical and you want managed failover.

Minimal self-host (Mumbai):
```bash
# e2-small VM, Container-Optimized OS, in asia-south1
docker run -d --name typesense --restart=always -p 443:8108 \
  -v /mnt/ts-data:/data typesense/typesense:27.1 \
  --data-dir /data --api-key='<STRONG_ADMIN_KEY>' --enable-cors
# Front with a TLS-terminating LB or run behind Cloud Run with a sidecar.
# Snapshot to GCS nightly:  curl .../operations/snapshot?snapshot_path=/data/snap
```
Set `TYPESENSE_HOST` to the VM/LB DNS, store the admin key as the
`TYPESENSE_API_KEY` secret, then run the backfill.

## What is NOT covered yet (follow-ups)

- **CANCELLED reindex** isn't wired into the ~6 admin/dispute transition sites
  — covered by the reader's self-healing filter + periodic backfill instead. If
  you want exact index hygiene, call `updateAuctionInIndex(id, { status })` at
  those sites.
- **Synonyms / Bangla analyzer** — Typesense supports both; add a synonyms set
  and a `bn` locale once you have query logs to mine.
- **Hard-delete sync** — `removeAuctionFromIndex(id)` exists; wire it wherever
  you ever hard-delete an auction (currently auctions are status-transitioned,
  not deleted).
