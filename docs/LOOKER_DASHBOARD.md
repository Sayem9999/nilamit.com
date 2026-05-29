# Looker Studio dashboard setup

A 30-minute one-time setup to get business + product metrics flowing
from BigQuery into a shareable dashboard.

## What you'll have at the end

A Looker Studio report with 7 panels:

1. **Web Vitals p75 trend** — LCP/CLS/INP by page, last 7 days
2. **Daily bid volume + GMV** — bid count + ৳ flowing through the marketplace
3. **Escrow funnel** — pending → held → released conversion
4. **Top sellers by GMV** — whales for VIP outreach
5. **Anti-snipe trigger rate** — calibrate `antiSnipeSeconds` in Remote Config
6. **Featured-listing revenue** — validate the new monetisation surface
7. **RUM session summary** — debug bad releases user-by-user

Data refreshes every 12 hours by default (configurable per data source).

## Setup steps

### 1. Open Looker Studio

https://lookerstudio.google.com — sign in with the same Google account
that has BigQuery access on `nilamit-52073`.

### 2. Create the data source

`+ Create` → `Data source` → `BigQuery` connector → `My projects` →
`nilamit-52073` → `nilamit_events` → `events`. Click `Connect`.

Looker auto-detects the schema (event_id, event_type, ts, user_id,
auction_id, amount_bdt, metadata). The JSON `metadata` field appears
as a plain string — extract individual fields per query (see below).

### 3. Add the 7 panels

For each panel, the source query is in `docs/LOOKER_QUERIES.sql`.
Looker Studio's "Custom Query" mode is the simplest path:

`+ Add data` → `BigQuery` → `Custom Query` → paste the SQL → name it.

Each query is bounded by a TIMESTAMP_SUB window so even with a full
refresh the scan stays cheap (a few MB per query).

| Panel | Chart type | Source query |
|-------|------------|--------------|
| Web Vitals trend | Time series | `LOOKER_QUERIES.sql` #1 |
| Bid volume + GMV | Combo chart (bars + line) | #2 |
| Escrow funnel | Table | #3 |
| Top sellers | Table | #4 |
| Anti-snipe trigger rate | Time series | #5 |
| Featured revenue | Combo chart | #6 |
| RUM sessions | Table (sortable) | #7 |

### 4. Set up scheduled-email reports

For business-metric alerting without a separate Slack integration:

Report → `Share` → `Schedule email delivery` → daily 09:00 BD time →
recipients.

This is the cheap MVP of business-metric alerting. For real
threshold-based alerts (e.g. "GMV dropped 30% vs yesterday"), wire a
Cloud Scheduler job that runs `bq query` against the same SQL and POSTs
to a Slack webhook on threshold breach. ~1 day of work; track in
`docs/ENTERPRISE_GAPS.md` under Gap 3.

### 5. Sanity check after setup

Open each panel and verify:
- **Web Vitals panel shows data within 6 hours of any production traffic** (RUM events from `WebVitalsReporter.tsx` ship to BigQuery via `/api/rum`).
- **Bid volume shows data within 6 hours of any bid** (`BidSideEffects.handleBidSideEffects` calls `log.event('bid_placed')`).
- **Featured revenue may be empty** until first seller buys a featured listing — that's expected.

## Costs

- BigQuery: pay-per-byte-scanned. The bounded WHERE clauses mean each query
  scans at most ~10 MB (1 day-partition × ~1 MB/day at current volume).
  At your current scale, **all 7 queries combined cost <$0.01/month**.
- Looker Studio: **free** for personal use; team sharing requires Looker Studio Pro (~$9/user/mo).
- BigQuery streaming inserts (already running): ~$0.05/GB inserted, which at
  current event volume is **~$1/month**.

## What this does NOT cover

- **Real-time alerts** (Slack ping when GMV craters): need a separate
  Cloud Scheduler + bq query + webhook job.
- **Anomaly detection** (auto-flag when today is statistically weird):
  needs BigQuery ML or a third-party tool like Anodot/Datadog.
- **User segment analysis** (cohort retention, LTV): needs a `users`
  dimension table to JOIN against; doc'd as a follow-up.

For where this fits in the broader observability stack: `docs/ENTERPRISE_GAPS.md` Gap 3.
