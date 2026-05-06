# Session Handoff — Audit + Hardening Pass (May 2026)

This document captures the work completed in the May 2026 audit-and-fix session and the open items the next agent should pick up. It is written so a fresh model can resume without re-reading the full chat transcript.

> **Updated 2026-05-07** — handoff items #2, #5, #6 are now done; #4 instrumented (Sentry hooks added to image-moderation, gc-uploads, sms-gateway). #3 still requires a real GreenWeb token from operations.

---

## State of `main`

- Branch protection: **off** (so unprotected; treat with care).
- CI: red on lint with **pre-existing** technical debt (10 lint errors in files we did not touch — see "Known tech debt" below). Lint debt is out of scope for this session and should be its own PR.
- Auto-deploy: Firebase App Hosting builds + deploys on every push to `main` via Cloud Build (`apphosting.yaml`). Live URL: `https://nilamit--nilamit-52073.asia-southeast1.hosted.app`.
- Most recent merges:
  - **PR #8** (`05fdd21`, 2026-05-06 08:40 UTC) — primary audit fixes.
  - **PR #9** (`bb0b033`, 2026-05-06 08:43 UTC) — `IMAGE_MODERATION=enabled`.

---

## What this session shipped

### Money / authz hardening
- `src/lib/ratelimit.ts` — per-limiter `Policy` flag. Financial limiters (`bidLimiter`, `authLimiter`, `loginLimiter`, all OTP limiters) now **fail CLOSED** in production. `apiLimiter` keeps fail-open. Closes a CLAUDE.md rule #3 violation that was silent.
- `src/actions/dispute.ts::resolveDispute` — verifies `escrow.exists` and `escrow.status === 'DISPUTED'` before flipping. Closes a race where an admin refund + dispute resolution could double-pay.
- `src/actions/dispute.ts::adminRefundEscrow` — single source of truth for refunds. Validates allowed status set, requires non-empty `reason`, increments seller `defectCount`, kicks off seller-performance recompute, audit-logs.
- `src/actions/escrow.ts::refundEscrow` — now a thin compat shim that delegates to `adminRefundEscrow`.
- `src/lib/auction-logic.ts` — moved `incrementGlobalStat('totalRevenue')` out of the transaction body into `sendSaleNotifications` (was double-counting on contention retries). Added `coerceEndTime()` so malformed auctions are EXPIRED rather than processed as sales.
- `src/services/bidding/bidding-service.ts::executeBuyItNow` — same endTime guard. Alerts batch chunked at 450 writes (Firestore caps at 500).

### Logistics PII closure
- New `src/lib/logistics.ts` — `'server-only'` internal module. `createLogisticsOrder` takes pre-loaded addresses (no caller-controlled user lookups). Tracking ID now `NLM-<time>-<random>` to avoid collisions. `updateLogisticsStatus` runs in `runTransaction` with `arrayUnion` for history.
- `src/actions/logistics.ts` — reduced to admin-only Server Action wrapper around the above. **`createLogisticsOrder` is no longer reachable from the public Server Actions wire** — closes the address-PII exfiltration vector that the previous version exposed.

### Admin gating
- `src/app/admin/page.tsx` — uses `requireAdmin().catch → redirect('/login')` (DB-deep, not JWT-only).
- `src/actions/admin-content.ts` — `getSystemConfig` and `getFeaturedAuctions` now require admin (were ungated reads).
- `src/app/admin/disputes/page.tsx` — server-side admin gate; client moved to `AdminDisputesClient.tsx`. Native `window.prompt` for resolution notes replaced with a styled modal (validates non-empty).

### Cron + GitHub Actions
- `.github/workflows/cron.yml` — was failing on every run before this session. Three bugs fixed:
  1. URL pointed at `nilamit.com` (not routable from GHA runners) → switched to `nilamit--nilamit-52073.asia-southeast1.hosted.app`.
  2. Used GET against POST-only routes → all `curl` calls now `-X POST`.
  3. POSTs without a body returned 411 → added `-H "Content-Type: application/json" --data '{}'`.
- Added the previously-unscheduled jobs: `closing-soon` (15 min), `process-alerts` (5 min), `enforce-policies` (hourly), `gc-uploads` (weekly Sun 04:00 UTC).
- `src/app/api/cron/enforce-policies/route.ts` — GET → POST + `verifyCronSecret`.
- `src/app/api/cron/process-auctions/route.ts` — now re-exports `close-auctions` to eliminate the duplicate.
- `src/app/api/cron/closing-soon/route.ts` — per-auction work parallelised in chunks of 8.
- `src/app/api/cron/process-alerts/route.ts` — deactivate batch chunked at 450/commit.

### Uploads
- `src/app/api/upload/route.ts` — replaced `makePublic()` with signed URLs (auction: 90 d, chat: 7 d). Wired in Cloud Vision SafeSearch via the new `src/lib/image-moderation.ts`. Sanitised `originalName` storage metadata.
- `src/lib/image-moderation.ts` — Vision SafeSearch wrapper. Hard-blocks `LIKELY`/`VERY_LIKELY` adult or violence. Auto-no-ops when `IMAGE_MODERATION != "enabled"` so the upload path is never blocked by an infra gap. Vision API enabled (`gcloud services enable vision.googleapis.com`); flag set to `enabled` in `apphosting.yaml`.
- New `src/app/api/cron/gc-uploads/route.ts` — weekly GC for orphaned Storage objects under `auctions/`. Only deletes files >7 d old that aren't referenced by any `auction.images` URL. Capped at 500 deletes/run, paginated.

### Frontend
- `src/components/auction/BidPanel.tsx` — BIN purchase native `confirm()` replaced with a real modal (cancel + click-outside + ARIA-modal + disabled-during-processing). Bid-amount auto-reset uses `userTouchedRef` instead of equality with the previous min, so manual entries aren't clobbered. `canvas-confetti` lazy-loaded so it doesn't ship in the initial bundle of every auction page.
- `src/hooks/useAuctionBids.ts` — accepts `initialBids` for server-side hydration.
- `src/app/auctions/[id]/page.tsx` — passes server-fetched bids through `BidPanelWrapper` so a refresh on a busy auction shows the latest 10 bids immediately.
- `src/components/layout/Navbar.tsx` — dropped unused `useLocale`/`usePathname`/`useRouter`, consolidated sign-out into one `handleSignOut`, removed unreachable `window.location.reload()`.
- `src/actions/bid.ts` — `newMinimum` extraction from `BID_TOO_LOW` error message now slices the prefix before regex (was concatenating digits embedded in the prefix).

### Firestore
- New composite indexes: `bidDeposits(bidderId, auctionId, status)` and `alerts(auctionId, type, isActive)`. **Already deployed** to project `nilamit-52073` via `firebase deploy --only firestore:indexes`.
- `firestore.rules` — added a comment block explaining the `request.auth.token.isAdmin` trust model. Custom-token mint at `/api/firebase/token` is real (not dead code); ~1 h staleness window is intentional and acceptable for read-only access. Server Actions remain the DB-deep authoritative path.

### i18n
- **Bangla dropped per direction.** Removed `messages/bn.json` and the dead `src/app/[locale]/` folder. `src/i18n/routing.ts` set to `['en']`. Added `Navigation.signedInAs` to `en.json`. Deduped duplicate keys (last-wins values preserved). Updated CLAUDE.md, README.md, AGENTS.md, docs/architecture.md, docs/summary.md.

### Operational
- **`CRON_SECRET` synced** between Firebase Secret Manager and GitHub Actions (was stale since 2026-02-16). Smoke-tested: 3/5 cron jobs pass against prod with the new secret; the other 2 will pass once auto-deploy lands the route changes.
- **PR #8 merged** to `main`.
- **Cloud Vision API enabled** on project `nilamit-52073`.
- **PR #9 merged** flipping `IMAGE_MODERATION=enabled`.

---

## Verification snapshot

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 53 / 53 pass |
| Pre-commit (eslint --fix on staged files) | clean on every commit |
| Firestore indexes deployed | yes |
| Manual cron run (`gh workflow run cron.yml -f job=all`) | 3/5 success against pre-deploy prod (close-auctions, closing-soon, process-alerts). Expect 5/5 once the May 2026 deploy completes. |

---

## Open items / "next" for the next agent

### Should do (real findings, not done)

1. **~~Pre-existing CI lint debt on `main`~~ — DONE 2026-05-07.** Fixed all 10 errors across `src/actions/auth.ts`, `src/app/admin/tabs/DisputesTab.tsx`, `src/app/page.tsx` (refactored to load data inside try/catch and render outside), and `src/app/profile/page.tsx`. CI lint is now zero-error.

2. **~~Confirm post-deploy state~~ — DONE 2026-05-06.** PR #11 (`process-auctions` route fix) and PR #12 (missing `auctions(status, updatedAt)` index) unblocked the deploy. All 5 cron jobs are now green against production. Storage bucket `nilamit-52073.firebasestorage.app` was auto-provisioned during the deploy.

3. **`GREENWEB_TOKEN` is still a placeholder** — STILL OPEN. SMS OTPs would silently fail in production today (the secret value `"console"` is truthy so `GreenWebGateway` instantiates with that as the token, all subsequent API calls return non-Ok). 2026-05-07: added `log.error` + Sentry capture in `src/lib/sms-gateway.ts` so failures are no longer silent — operator should see Sentry alerts the next time someone tries to verify a phone. Real fix: get a GreenWeb token, `gcloud secrets versions add GREENWEB_TOKEN --data-file=- --project=nilamit-52073`, redeploy.

4. **~~Sentry visibility for new code paths~~ — INSTRUMENTED 2026-05-07.** Added `Sentry.captureException` / `captureMessage` calls in `src/lib/image-moderation.ts` (Vision client unavailable + API error paths) and `src/app/api/cron/gc-uploads/route.ts` (cron-level failures). Next agent should still verify alerts fire end-to-end once organic traffic arrives.

### Could do (P2, not urgent)

5. **Translate `useTranslations` text in dynamically-imported components.** `BidPrompts` (eliteBarrier modal) and `VerificationGuard` use the i18n layer — fine for English but a future locale would need keys mirrored. Also: `EscrowActionCard.tsx` and `GatedContactInfo.tsx` still have a few hardcoded English strings (and `GatedContactInfo.tsx` had hardcoded Bengali strings; replaced 2026-05-07 — now uses English literals; the right long-term fix is to move them into `messages/en.json`).

6. **~~`payEscrowAdvance` UX for missing addresses~~ — DONE 2026-05-07.** `src/components/social/EscrowActionCard.tsx` and `src/components/ui/GatedContactInfo.tsx` now detect `ADDRESS_REQUIRED`, `SELLER_ADDRESS_MISSING`, and `MFS_LINKAGE_REQUIRED` error codes and show specific toasts + redirect to `/profile` where appropriate.

7. **~~`/api/logistics/labels/<trackingId>` endpoint~~ — DONE 2026-05-07.** Removed the `labelUrl` field from `createLogisticsOrder` and the auction `logistics` map. When a real provider (Pathao / RedX) is wired up, the courier's webhook should populate `logistics.labelUrl` directly, not this code path.

8. **Operational: rotate `CRON_SECRET` to a new value** in both Firebase Secret Manager + GitHub Actions secret. Was synced 2026-05-06 but never rotated; the value has been live since 2026-02-16 and may have leaked through CI logs.

### Won't do without explicit ask (out of scope)

- Rolling back any of the May 2026 changes.
- Reintroducing Bengali (the user explicitly dropped it).
- Touching the live escrow / dispute state machine in production.

---

## Useful commands for the next agent

```bash
# Deploy state
firebase apphosting:rollouts:list nilamit --project nilamit-52073
gcloud builds list --project=nilamit-52073 --region=asia-southeast1 --limit=3

# Cron health
gh workflow run cron.yml --ref main -f job=all
gh run list --workflow=cron.yml --limit=5

# Secret sync (if you ever rotate)
gh secret set CRON_SECRET --repo Sayem9999/nilamit.com \
  --body "$(gcloud secrets versions access latest --secret=CRON_SECRET --project=nilamit-52073)"

# Smoke endpoints (expect 401 without real bearer)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://nilamit--nilamit-52073.asia-southeast1.hosted.app/api/cron/close-auctions" \
  -H "Authorization: Bearer dummy" -H "Content-Type: application/json" --data '{}'

# Index deploy
firebase deploy --only firestore:indexes --project nilamit-52073

# Local verify
npx tsc --noEmit && npx vitest run
```

---

## Important context the next agent should NOT forget

- **CLAUDE.md is loaded automatically** — the Critical Rules block (now 14 rules) is the source of truth for conventions. New rules added this session: #13 (logistics writes), #14 (refund consolidation), and the upgrade to #12 (Vision moderation + signed URLs).
- **No `[locale]` folder.** Routes are flat. If you see docs claiming `src/app/[locale]/admin/`, they're stale.
- **No Cloud Scheduler.** All crons run from `.github/workflows/cron.yml`. If you find yourself reaching for `gcloud scheduler`, you're wrong — the API isn't even enabled.
- **Vision moderation is fail-open by design.** A Vision API outage allows uploads to continue (with a Sentry warning). Don't "fix" this to fail-closed without consulting — the auction listing flow can't tolerate Vision being a hard dependency.
- **`refundEscrow` and `adminRefundEscrow` are the same code path.** Don't add a new refund action; extend `adminRefundEscrow`.
