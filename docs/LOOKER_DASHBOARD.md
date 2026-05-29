# Looker Studio dashboard setup — 5-minute one-click version

7 BigQuery **views** are already created in `nilamit-52073:nilamit_events.*`:

| View | What it shows |
|------|---------------|
| `v_web_vitals_p75` | LCP/CLS/INP/FCP/TTFB p75 + p50 by route, last 7d |
| `v_bid_volume_daily` | Daily bids, unique bidders, auctions, GMV — last 30d |
| `v_escrow_funnel` | Pending → held → released → refunded, plus completion rate, last 30d |
| `v_top_sellers` | Top 50 sellers by GMV, last 30d |
| `v_anti_snipe_rate` | % of bids that triggered anti-snipe extension, last 7d |
| `v_featured_revenue` | Featured-listing purchases + revenue, last 30d |
| `v_rum_sessions` | Per-session web-vitals summary, last 24h |

Since they're views (not custom queries), Looker can introspect their
schemas — pick chart types without retyping SQL.

## One-click setup

Each link below opens Looker Studio with that view pre-attached as a
data source. Click → Sign in with the same Google account that owns
`nilamit-52073` → `Add to report` → drag fields to charts.

(URLs use the Looker Studio Linking API. They're long because the
config inline-encodes; no shortener needed since they're personal
one-time setup links.)

### 1. Web Vitals p75 trend → suggested chart: **Time series**

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_web_vitals_p75&ds.refreshFields=true
```

Drag `day` → Time dimension, `p75` → Metric, `path` + `metric` → Breakdown dimensions.

### 2. Bid volume + GMV → **Combo chart** (bars + line)

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_bid_volume_daily&ds.refreshFields=true
```

`day` → X-axis. Bars: `bid_count`. Line: `gross_bid_volume_bdt`.

### 3. Escrow funnel → **Table** (or Sankey if you install the community viz)

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_escrow_funnel&ds.refreshFields=true
```

`day`, `pending`, `held`, `released`, `refunded`, `completion_rate`.

### 4. Top sellers → **Table** (sortable)

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_top_sellers&ds.refreshFields=true
```

`seller_id` → Row dimension. Metrics: `gmv_bdt`, `bids_received`, `auctions_with_bids`.

### 5. Anti-snipe trigger rate → **Time series**

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_anti_snipe_rate&ds.refreshFields=true
```

`day` → X. Line: `pct_extended`. Watch this when tuning the
`antiSnipeSeconds` Remote Config flag.

### 6. Featured revenue → **Combo chart**

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_featured_revenue&ds.refreshFields=true
```

`day` → X. Bars: `purchases`. Line: `revenue_bdt`. Empty until first
seller hits the new "Promote to Featured" CTA — expected.

### 7. RUM sessions → **Table** (debug bad releases)

```
https://lookerstudio.google.com/datasources/create?connectorId=2&ds.connector=bigQuery&ds.type=TABLE&ds.projectId=nilamit-52073&ds.datasetId=nilamit_events&ds.tableId=v_rum_sessions&ds.refreshFields=true
```

Sort by `lcp_ms DESC` to find the slowest sessions. Filter by
`first_seen >= today` to debug a fresh release.

## Combining all 7 into one report

After clicking each link above and adding it to a NEW report:

1. In the first link's Looker tab, click `Create Report`.
2. Name it "Nilamit Dashboard".
3. For each subsequent data source: `+ Add data` → `Existing data sources` → pick the view you just created.
4. Drag charts onto the canvas (7 panels total).

Total click count: ~30 clicks. Time: ~5 minutes.

## Scheduled email refresh

In the report: `Share` → `Schedule email delivery` → daily 09:00 BD time → recipients.

Free, fires every morning so you wake up knowing GMV.

For real threshold alerts ("ping Slack when GMV drops 30% vs yesterday"), wire a Cloud Scheduler + `bq query` + webhook job — ~1 day of work, tracked under Gap 3 in `docs/ENTERPRISE_GAPS.md`.

## Costs

- BigQuery query scans: each view restricts via `TIMESTAMP_SUB` so a full refresh scans <10 MB. All 7 views combined: **<$0.01/month** at current event volume.
- Looker Studio: free for personal use. Looker Studio Pro (~$9/user/mo) only needed for team sharing with role-based access.
- BigQuery streaming inserts (already running): ~$1/month at current ingest rate.

## Maintenance

When you want to add a new metric:
1. Edit the matching `v_*` view: `bq update --view='NEW SQL' nilamit_events.v_*`
2. Looker auto-picks up the new columns next refresh (default 12h; force a refresh in Looker UI for testing).

No code deploys required for new dashboard metrics — the SQL is the source of truth.

## What this does NOT cover

- **Real-time alerts** (Slack ping on threshold breach): needs Cloud Scheduler + webhook
- **Anomaly detection** (auto-flag statistical weirdness): needs BigQuery ML or Anodot/Datadog
- **Cohort / retention analysis**: needs a `users` dimension table to JOIN; tracked as separate follow-up

For the broader observability roadmap: `docs/ENTERPRISE_GAPS.md` Gap 3.
