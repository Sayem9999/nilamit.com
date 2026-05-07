# Sentry Alerts — Setup Guide

Sentry SDK is wired (`sentry.{client,server,edge}.config.ts`, EU region,
`SENTRY_DSN` in Secret Manager). What's **not yet** wired: the alert rules
themselves. Sentry alert rules live in the Sentry UI / Sentry's API — they
are not in this repo. This doc is the canonical list of rules to create and
how to verify them.

> **TL;DR:** open https://sentry.io/organizations/nilamit/alerts/rules/ and
> create the 7 rules below. Total time: ~15 min.

---

## Project tags we set (use these in alert filters)

The SDK sets these on every event captured from Nilamit. Filter your alert
rules on them so paging stays signal-rich.

| Tag | Values | Where it's set |
|---|---|---|
| `environment` | `production`, `development` | Auto from `NODE_ENV` |
| `area` | `bid`, `escrow`, `auth`, `cron`, `upload`, `admin`, `chat`, `dispute`, `logistics` | `tagSentryArea()` in `src/lib/sentry-tags.ts` |
| `severity` | `critical`, `warning`, `info` | Set when re-raising via `Sentry.captureException` |

To tag a code path as "alertable as critical", call:

```ts
import { tagSentryArea } from '@/lib/sentry-tags';
tagSentryArea('bid', 'critical');
```

before the throw / `captureException`. The current code already does this
on the financial paths (`placeBid`, escrow state transitions, refund).

---

## The 7 alert rules (priority order)

### 1. **CRITICAL — Bid path errors** (page on-call)
- **Project filter:** `area:bid` AND `environment:production`
- **Trigger:** `event.count` ≥ 5 in 5 minutes
- **Action:** Slack `#nilamit-oncall` + email `sayemf21@gmail.com`
- **Why:** Bidding is the core revenue path. Five errors in 5 min is a
  user-facing outage, not a single user's flake.

### 2. **CRITICAL — Escrow state transition errors** (page on-call)
- **Project filter:** `area:escrow` AND `environment:production`
- **Trigger:** `event.count` ≥ 1 in 5 minutes
- **Action:** Slack `#nilamit-oncall` + email + SMS via Sentry's PagerDuty integration if you wire it
- **Why:** Money moving incorrectly is the worst-case bug. Single occurrence pages.

### 3. **CRITICAL — Cron job failures** (page on-call within an hour)
- **Project filter:** `area:cron` AND `environment:production`
- **Trigger:** `event.count` ≥ 3 in 30 minutes
- **Action:** Slack `#nilamit-oncall` + email
- **Why:** GitHub Actions retries cron 3× before giving up — three failures
  means the route is genuinely down, not a transient blip. The
  `cronFailures` Firestore collection also tracks this; Sentry is the
  push path.

### 4. **WARNING — Auth failures spike**
- **Project filter:** `area:auth` AND `environment:production`
- **Trigger:** `event.count` ≥ 20 in 10 minutes
- **Action:** Slack `#nilamit-alerts` (no page)
- **Why:** Could be brute-force, could be a misconfigured OAuth provider.
  Worth investigating, not worth waking up for.

### 5. **WARNING — Upload pipeline errors**
- **Project filter:** `area:upload` AND `environment:production`
- **Trigger:** `event.count` ≥ 10 in 15 minutes
- **Action:** Slack `#nilamit-alerts`
- **Why:** Cloud Vision SafeSearch quota exhaustion or magic-byte rejection
  spikes show up here. Catches problems with `IMAGE_MODERATION` before
  users complain.

### 6. **WARNING — Performance regression (P75 latency)**
- **Project filter:** `transaction.op:http.server` AND `environment:production`
- **Trigger:** `p75(transaction.duration)` > 2000ms over 5 min
- **Action:** Slack `#nilamit-alerts`
- **Why:** P75 > 2s on the median page means something's burning. The
  20% trace sample rate is enough to catch it.

### 7. **INFO — New issue type**
- **Project filter:** `event.type:error` AND `environment:production`
- **Trigger:** `is:unresolved is:new` (Sentry default "first-seen")
- **Action:** Slack `#nilamit-alerts`
- **Why:** A brand-new error class deserves attention even if low volume —
  it's how regressions surface.

---

## How to create them in the Sentry UI

1. Open https://sentry.io/organizations/nilamit/alerts/rules/
2. Click **Create Alert Rule** → choose **Issue Alert** (rules 1–5, 7) or
   **Metric Alert** (rule 6).
3. Set the **environment** filter at the top. Critical: leave dev/staging
   off these rules — the noise will train you to ignore them.
4. Add the tag filter (`area:bid`, etc.).
5. Set the threshold and time window from the table.
6. Add actions → Slack (set up the integration first if not already) +
   email. For rules 1 and 2, also enable PagerDuty (optional).
7. Save. **Set the rule owner to `@sayem`** so the inbox routing works.

---

## Slack integration setup (one-time)

If `#nilamit-oncall` and `#nilamit-alerts` aren't connected to Sentry yet:

1. Sentry → Settings → Integrations → Slack → **Add Workspace**
2. Authorize the Nilamit Slack workspace.
3. In Slack, run `/sentry link` in each channel and follow the prompt.
4. The alerts above can then target those channels by name.

---

## Verifying the alerts work

Each rule should fire end-to-end before you trust it. The cheapest way:

```bash
# From the deployed app, hit the test endpoint (already exists):
curl https://nilamit--nilamit-52073.asia-southeast1.hosted.app/api/sentry-test
```

That endpoint deliberately throws an error tagged `area:test`. Confirm the
event lands in Sentry within ~30s. Then once per critical area, manually
add a `throw new Error("sentry rule test")` behind a feature flag, deploy
to a staging branch, and confirm the alert fires.

For the metric alert (rule 6), there's no easy way to fake a P75 spike —
just wait for the first time it triggers naturally and confirm the Slack
post.

---

## Tuning over time

- After two weeks of alerts in production, review which rules are firing
  too often (alert fatigue) or too rarely (missing real incidents).
- The `event.count` thresholds above are **starting points** based on the
  current ~hundreds-of-bids-per-day traffic shape. Re-tune at 10×.
- If you start using OpenTelemetry tracing later, replace rule 6 with a
  per-route P95 alert — much more useful than aggregate P75.

---

## What's *not* in Sentry (deliberate)

- **Cron success metrics:** GitHub Actions handles the schedule and
  reports failures via the workflow UI itself. Sentry is the secondary
  path for when the route was hit but threw.
- **User-facing errors that aren't bugs** (404, 401): these are filtered
  out in `sentry.{server,client}.config.ts` via `ignoreErrors`. Don't
  alert on them.
- **Firebase quota errors:** these surface in Cloud Logging, not Sentry.
  Set up a Cloud Logging alert separately if you want to be paged on
  Firestore quota exhaustion.
