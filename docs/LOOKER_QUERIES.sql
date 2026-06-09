-- Looker Studio source queries for the nilamit_events.events table.
--
-- All queries are validated against the live BigQuery table. Paste each
-- one into Looker Studio as a "Custom Query" data source (no joins
-- needed). Schedule refresh every 12h — the event_type cardinality
-- doesn't change fast enough to warrant tighter cadence + it costs
-- money per scan.
--
-- Dataset: nilamit-52073.nilamit_events.events
-- Schema:
--   event_id    STRING   REQUIRED  (UUID per event)
--   event_type  STRING   REQUIRED  (bid_placed | auction_* | escrow_* | web_vital | …)
--   ts          TIMESTAMP REQUIRED (partition key)
--   user_id     STRING   NULLABLE
--   auction_id  STRING   NULLABLE
--   amount_bdt  INT64    NULLABLE
--   metadata    JSON     NULLABLE
--
-- Cost shape: queries hit the day-partition on `ts` and the cluster on
-- (event_type, user_id) — full table scans never happen as long as you
-- keep the WHERE clause's ts range bounded.

-- ────────────────────────────────────────────────────────────────────
-- 1. Web vitals — p75 LCP / CLS / INP by route, last 7 days
--    Use case: "Are our slowest pages getting slower?"
-- ────────────────────────────────────────────────────────────────────
SELECT
  DATE(ts, 'Asia/Dhaka') AS day,
  JSON_VALUE(metadata, '$.path') AS path,
  JSON_VALUE(metadata, '$.name') AS metric,
  -- p75 is the canonical web-vitals threshold reporter
  APPROX_QUANTILES(CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), 100)[OFFSET(75)] AS p75,
  APPROX_QUANTILES(CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), 100)[OFFSET(50)] AS p50,
  COUNT(*) AS samples
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'web_vital'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY day, path, metric
ORDER BY day DESC, samples DESC;

-- ────────────────────────────────────────────────────────────────────
-- 2. Daily bid volume + GMV, last 30 days
--    Use case: "Is the marketplace healthy?" + alert if drop > 30%
-- ────────────────────────────────────────────────────────────────────
SELECT
  DATE(ts, 'Asia/Dhaka') AS day,
  COUNT(*) AS bid_count,
  COUNT(DISTINCT user_id) AS unique_bidders,
  COUNT(DISTINCT auction_id) AS auctions_bid_on,
  SUM(amount_bdt) AS gross_bid_volume_bdt,
  ROUND(AVG(amount_bdt)) AS avg_bid_bdt
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'bid_placed'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day DESC;

-- ────────────────────────────────────────────────────────────────────
-- 3. Escrow funnel, last 30 days
--    Use case: drop-off analysis — where do buyers stall?
-- ────────────────────────────────────────────────────────────────────
SELECT
  DATE(ts, 'Asia/Dhaka') AS day,
  COUNTIF(event_type = 'escrow_pending')   AS pending,
  COUNTIF(event_type = 'escrow_held')      AS held,
  COUNTIF(event_type = 'escrow_released')  AS released,
  COUNTIF(event_type = 'escrow_refunded')  AS refunded,
  SAFE_DIVIDE(COUNTIF(event_type = 'escrow_released'), COUNTIF(event_type = 'escrow_pending')) AS completion_rate
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type LIKE 'escrow_%'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day DESC;

-- ────────────────────────────────────────────────────────────────────
-- 4. Top sellers by GMV, last 30 days
--    Use case: identify whales for VIP outreach / Pro Retailer upgrades
-- ────────────────────────────────────────────────────────────────────
SELECT
  -- The seller is the inverse of the bidder; we infer via auction metadata.
  -- Simplest aggregation: bids placed on the user's auctions.
  JSON_VALUE(metadata, '$.sellerId') AS seller_id,
  COUNT(*) AS bids_received,
  SUM(amount_bdt) AS gmv_bdt,
  COUNT(DISTINCT auction_id) AS auctions_with_bids
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'bid_placed'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND JSON_VALUE(metadata, '$.sellerId') IS NOT NULL
GROUP BY seller_id
ORDER BY gmv_bdt DESC
LIMIT 50;

-- ────────────────────────────────────────────────────────────────────
-- 5. Anti-snipe trigger rate, last 7 days
--    Use case: tune ANTI_SNIPE_SECONDS in Remote Config based on data
-- ────────────────────────────────────────────────────────────────────
SELECT
  DATE(ts, 'Asia/Dhaka') AS day,
  COUNTIF(SAFE_CAST(JSON_VALUE(metadata, '$.antiSnipeExtended') AS BOOL) = TRUE) AS extended,
  COUNT(*) AS total_bids,
  ROUND(
    SAFE_DIVIDE(
      COUNTIF(SAFE_CAST(JSON_VALUE(metadata, '$.antiSnipeExtended') AS BOOL) = TRUE),
      COUNT(*)
    ) * 100,
    2
  ) AS pct_extended
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'bid_placed'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY day
ORDER BY day DESC;

-- ────────────────────────────────────────────────────────────────────
-- 6. Featured-listing purchase rate, last 30 days
--    Use case: validate that the new revenue surface is being used
-- ────────────────────────────────────────────────────────────────────
SELECT
  DATE(ts, 'Asia/Dhaka') AS day,
  COUNT(*) AS purchases,
  COUNT(DISTINCT user_id) AS unique_sellers,
  SUM(amount_bdt) AS revenue_bdt,
  AVG(CAST(JSON_VALUE(metadata, '$.days') AS INT64)) AS avg_duration_days
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'auction_featured'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day DESC;

-- ────────────────────────────────────────────────────────────────────
-- 7. RUM session-level summary (one row per session, last 24h)
--    Use case: detect a broken release shipping bad LCP to ~all users
-- ────────────────────────────────────────────────────────────────────
SELECT
  JSON_VALUE(metadata, '$.sessionId') AS session_id,
  COUNT(DISTINCT JSON_VALUE(metadata, '$.path')) AS pages_viewed,
  MAX(IF(JSON_VALUE(metadata, '$.name') = 'LCP', CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), NULL)) AS lcp_ms,
  MAX(IF(JSON_VALUE(metadata, '$.name') = 'CLS', CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), NULL)) AS cls,
  MAX(IF(JSON_VALUE(metadata, '$.name') = 'INP', CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), NULL)) AS inp_ms,
  MIN(ts) AS first_seen,
  MAX(ts) AS last_seen
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'web_vital'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY session_id
HAVING pages_viewed > 0
ORDER BY first_seen DESC
LIMIT 500;

-- ────────────────────────────────────────────────────────────────────
-- 8. TTFB p75 by connection class — the data-locality signal
--    Use case: Firestore lives in US (nam5) but users are in BD. TTFB is
--    dominated by the server round-trip. If p75 TTFB is high even on '4g'
--    links, the bottleneck is server/data distance (the locality lever),
--    NOT the user's connection. Slice the fix's impact here.
--    Requires the effectiveType field added to the RUM payload.
-- ────────────────────────────────────────────────────────────────────
SELECT
  COALESCE(JSON_VALUE(metadata, '$.effectiveType'), 'unknown') AS connection,
  APPROX_QUANTILES(CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), 100)[OFFSET(75)] AS ttfb_p75_ms,
  APPROX_QUANTILES(CAST(JSON_VALUE(metadata, '$.value') AS FLOAT64), 100)[OFFSET(50)] AS ttfb_p50_ms,
  COUNT(*) AS samples
FROM `nilamit-52073.nilamit_events.events`
WHERE event_type = 'web_vital'
  AND JSON_VALUE(metadata, '$.name') = 'TTFB'
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY connection
ORDER BY samples DESC;
