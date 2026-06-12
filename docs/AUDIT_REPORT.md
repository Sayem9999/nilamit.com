# Production Audit Report

> **Session 3 (full-stack):** June 12, 2026 — commits `2c2e223` through `4312e84`
> **Sessions 1–2:** April 29, 2026 — commits `951f31c` through `012fcf6`

---

## Session 3 — Full-Stack Audit (June 12, 2026)

Sweep of server actions, API routes, middleware, admin panel, and client bid/escrow paths. **10 issues fixed, all merged to main.** Recurring theme: `'use server'` files exposing internals as public endpoints (now CLAUDE.md rule #19).

### Critical — Unauthenticated Endpoints

| # | Finding | File | Fix |
|---|---|---|---|
| S3-C1 | `export { auth }` from a `'use server'` module exposed NextAuth's `auth` as a public server-action endpoint | `actions/admin/ops.ts` | Removed re-export (`863dbac`) |
| S3-C2 | Dead `'use server'` file with zero importers exposed `processSaleGamification(anyUserId)` — self-award XP/badges/streaks | `actions/gamification.ts` | Deleted (`fb425a3`) |
| S3-C3 | Dead `'use server'` file exposed `sendEmailVerificationByEmail(anyEmail)` — unlimited arbitrary-recipient email spam | `actions/email-server.ts` | Deleted (`fb425a3`) |
| S3-C4 | `'use server'` on internal lib made `recalculateUserRating(anyUserId)` a public write-trigger + read amplifier (100 review reads/call) | `lib/rating.ts` | Directive stripped — plain server lib (`fb425a3`) |
| S3-C5 | Open redirect: `/en//evil.com` → prefix-strip left protocol-relative `//evil.com` → `new URL()` resolves off-origin | `middleware.ts` | Leading slashes collapsed; query string now preserved (`fb425a3`) |

### High — Correctness / Abuse

| # | Finding | Fix |
|---|---|---|
| S3-H1 | Admin broadcast skipped legacy users: `where('isBanned','!=',true)` only matches docs where the field exists | Recency-ordered fetch + in-app ban filter (`74f5c13`) |
| S3-H2 | Payment webhook JSON branch with bad secret fell through to `req.formData()` on a consumed body → misleading 500 | Explicit 401 (`4312e84` range, `fb425a3`) |
| S3-H3 | `getSmartPricingSuggestion` public + unauthenticated — anonymous Firestore-read amplifier over sold auctions | Auth-gated + per-user `apiLimiter` (`4312e84`) |
| S3-H4 | `payEscrowAdvance` wrote unvalidated client-supplied `providerRef` to Firestore/ledger/admin screens | Trim, 64-char cap, charset check (`fb425a3`) |

### Medium — Admin Panel Quality (`863dbac`)

- Tab state deep-linked to URL hash (refresh/back/share no longer reset to Overview); mobile drawer backdrop + Escape-to-close; `aria-current`/`aria-expanded`/focus rings.
- Treasury: `title` attribute was inside the `className` string (tooltip never rendered); fabricated metrics ("100% Automated", "2.4s Response") replaced with real counts (rule #18); dead "Export Ledger" button wired to CSV export.
- Homepage CTA was signup-pitch for logged-in users → auth-aware Start Selling (`2c2e223`).

### Verified Clean (no action needed)

All 9 cron/task routes check `CRON_SECRET`; upload/FCM/courier-webhook routes authenticated; no `Math.random()` in OTP paths; no `makePublic()`; no inline admin checks; no client-side Firestore writes; no PII in public auction readers; BidPanel double-submit-guarded; escrow actions enforce ownership + state preconditions in transactions.

---

## Summary

A full-codebase security and correctness audit was performed covering authentication, financial transaction integrity, rate limiting, database query patterns, CSP configuration, and CI/CD pipeline. **30 issues** identified across two audit sessions. **All fixable issues resolved.**

---

## Code Fixes (all merged to main)

### Critical — Security / Data Corruption

| # | Finding | File | Fix |
|---|---|---|---|
| C1 | Real credentials (`GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`) in `.env` | `.env` | **Manual:** Rotate in Google Cloud Console + Secret Manager |
| C2 | OTP generated with `Math.random()` — not cryptographically secure | `actions/phone.ts:26` | `crypto.randomInt(100_000, 1_000_000)` |
| C3 | Dual cron routes with incompatible logic — wrong escrow status, no reserve price check, no commission, non-atomic batch writes | `api/cron/process-auctions` | Route rewired to `closeAllEndedAuctions()`; RTDB winner notification moved to `processAuctionSale()` |
| C4 | `placeBid` explicitly failed open on Redis down — rate limiting bypassed | `actions/bid.ts:38` | Removed `try/catch` wrapper; `bidLimiter` already fail-closes in production |
| C5 | `refundEscrow` inline admin check — case-sensitive, bypassed `requireAdmin()` | `actions/escrow.ts:172` | Replaced with `requireAdmin()` |
| C6 | `markAsShipped` non-atomic — TOCTOU race on status + ownership check | `actions/escrow.ts:142` | Wrapped in `db.runTransaction()` |

### High — Logic / Integrity

| # | Finding | Fix |
|---|---|---|
| H1 | Reserve price not checked in `process-auctions` cron | Fixed via C3 — `processAuctionSale()` enforces reserve |
| H2 | Wrong escrow amount for verified sellers | Fixed via C3 |
| H3 | JWT `isBanned` stale for 24 hours | Token refresh interval: 24h → 5min |
| H4 | `containsPII()` stateful global regex — alternating false negatives | Added non-`/g` test regexes; `containsPII` uses them |
| H5 | N+1 queries in admin dispute/treasury/escrow functions | `batchHydrateEscrowRows()` — 3 round-trips regardless of N; `getOpenDisputes` 3-pass batch |
| H6 | `processExpiredAuctions` no `.limit()` — OOM risk | Fixed via C3 — `closeAllEndedAuctions()` has `.limit(50)` |
| H7 | `outbox_events` writes with no consumer — dead code | Removed |

### Medium — Bad Practice / Future Risk

| # | Finding | Fix |
|---|---|---|
| M1 | Phone-only signup stored fake `@nilamit.placeholder` email | Stores `email: null` |
| M2 | Payment reference used `Math.random()` | `randomUUID()` |
| M3 | `totalAuctions: null` hardcoded in admin stats | Real `count()` aggregation |
| M4 | All 4 cron routes used `GET` for mutations | Changed to `POST` |
| M5 | Firebase Admin silently fell back to mock app on missing credentials | Now throws `Error` |
| M6 | Firestore messages rule used `get()` per read — expensive | `buyerId`/`sellerId` denormalized onto message docs; rule uses `resource.data` |
| M7 | Verification token doc ID used ambiguous `__` compound key | SHA-256(`identifier:token`) |
| M8 | Live ticker showed bids from expired/cancelled auctions | Fetches 25, filters `status === ACTIVE`, slices to 10 |

### Low — Cleanup

| # | Finding | Fix |
|---|---|---|
| L1 | `npm install` instead of `npm ci` in CI | Documented Linux lockfile regeneration; `package-lock.json` regenerated |
| L2 | CI deploy job was a placeholder Docker push | Removed; Firebase App Hosting handles git-triggered deploys |
| L3 | `getAuctions` silently returned empty on any error | Errors now route through `log.error()` → Sentry |
| L4 | Duplicate `ADMIN_EMAILS` parsing in 3 files | Removed; all use `requireAdmin()` |
| L5 | `storage.googleapis.com` missing from CSP `connect-src` | Added |
| L6 | `'unsafe-eval'` in CSP `script-src` | Removed |

### Additional Fixes (second audit pass)

| # | Finding | Fix |
|---|---|---|
| A1 | `placeBid` missing `placeBidSchema.safeParse()` | Added at action boundary |
| A2 | `raiseDispute` non-atomic — TOCTOU on status check | `db.runTransaction()` + idempotent composite doc ID |
| A3 | `resolveDispute` non-atomic batch | `db.runTransaction()` |
| A4 | Firestore messages `get()` per read | Denormalized in `sendMessage()`, rule updated |
| A5 | `sendMessage` no content length/URL validation | `sendMessageSchema` (content 1–2000, imageUrl valid URL) |
| A6 | `raiseDispute` no reason validation | `raiseDisputeSchema` (10–1000 chars) |
| A7 | `reportAuction` TOCTOU + no validation | `reportAuctionSchema` + transaction + composite doc ID |
| A8 | Cloud Scheduler script used `GET` for all cron jobs | Changed to `POST` |
| A9 | 6 API routes used `console.error` instead of `log.error` | All routed to structured logger → Sentry |
| A10 | N+1 in `closing-soon` cron (per-watcher user fetch) | `db.getAll()` batch per auction |
| A11 | N+1 in `process-alerts` cron (per-alert auction fetch) | `db.getAll()` single batch for all alerts |
| A12 | N+1 in `getUserReviews` | `db.getAll(...refs)` for reviewers + auctions |
| A13 | `submitReview` reputation scanned all reviews | Capped at 100 most recent (`orderBy createdAt desc, limit 100`) |
| A14 | `updateProfile` no input validation | `updateProfileSchema` (name 2–80, image valid URL) |
| A15 | `getPublicProfile` fetched all auction/bid docs | `.count().get()` aggregations |
| A16 | EU Sentry DSN (`ingest.de`) not in CSP `connect-src` | Added `https://*.ingest.de.sentry.io` |

---

## Deployment Fixes (Firebase App Hosting)

These issues were discovered during the first deployment attempt:

| Build | Error | Fix |
|---|---|---|
| All early | `IAM_PERMISSION_DENIED` on secrets | `firebase apphosting:secrets:grantaccess` for all 14 secrets to the App Hosting backend |
| `60010908` | `GREENWEB_TOKEN` secret missing | Created placeholder secret |
| `5494e9c3` | `SENTRY_DSN` permission denied | Created secret + granted access |
| `95d8ba1e` + `cdb18630` | `npm ci` fails — `@emnapi/runtime@1.10.0` + `@emnapi/core@1.10.0` missing from lockfile | Manually added entries with correct npm registry integrity hashes. Root cause: `vitest→vite→rolldown→@rolldown/binding-wasm32-wasi` pulls these deps; Windows npm skips wasm32 optional packages so they're absent from the lockfile |
| `7d46353d` | `husky: not found` — `prepare` script fails in `NODE_ENV=production` | `"prepare": "husky \|\| true"` — fails silently when devDeps absent |

---

## Remaining Manual Work

| Item | Action |
|---|---|
| **Rotate credentials** | `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` were in `.env` file (potentially in git history). Rotate at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and update in Secret Manager |
| **SMS (OTPs)** | `GREENWEB_TOKEN` is a placeholder (`"console"`). Get real token from greenweb.com.bd, update secret, add `SMS_PROVIDER=greenweb` to `apphosting.yaml` |
| **Auth.js v5 beta** | Monitor for stable release and upgrade |
| **Linux lockfile** | `package-lock.json` was patched manually. Regenerate properly with `docker run --rm -v $(pwd):/app -w /app node:20 npm install` for a clean state |

---

## Test Coverage

53 unit tests passing across 3 test files:
- `tests/unit/bid-rules.test.ts` — `validateBidPreconditions`, `computeAntiSnipeExtension`
- `tests/unit/sanitizer.test.ts` — XSS sanitization, `filterPII`, `containsPII` (stateful regex regression)
- `tests/unit/schemas.test.ts` — All Zod schemas + OTP range regression (1000 iterations)
