# CLAUDE.md — Nilamit Development Guide

This file is loaded automatically by Claude Code at the start of every session.

---

## What This Project Is

**nilamit.app** is a live production C2C auction marketplace for Bangladesh. Users list items, others bid in real-time, and the winner pays through an escrow system backed by bKash/Nagad mobile money. English-only (Bengali was dropped — `next-intl` is still wired as the message-loading layer but only `en.json` ships).

**Stack:** Next.js 16 App Router, Firebase (Firestore + RTDB + Storage + Auth), Auth.js v5, Upstash Redis, Sentry (EU region), Tailwind CSS 4.

**Deployed:** Firebase App Hosting (`nilamit` backend, project `nilamit-52073`). Push to `main` → auto-deploy via Cloud Build.

**Live URL:** `https://nilamit--nilamit-52073.asia-southeast1.hosted.app`

**Admin panel:** `/admin` — gated by `requireAdmin()` in [src/lib/admin-guard.ts](src/lib/admin-guard.ts) (DB-deep check, not JWT-only). Admin emails come from `ADMIN_EMAILS` (`sayemf21@gmail.com`).

**Cron:** GitHub Actions workflow in [.github/workflows/cron.yml](.github/workflows/cron.yml) hits the `/api/cron/*` POST endpoints with `Bearer ${CRON_SECRET}`. There is **no** Cloud Scheduler. Five jobs scheduled: `close-auctions` + `process-alerts` (every 5 min), `closing-soon` (every 15 min), `enforce-policies` (hourly), `gc-uploads` (weekly Sun 04:00 UTC).

**i18n:** English-only. `next-intl` is wired as the message-loading layer for future expansion but only `messages/en.json` ships. Adding a locale = update `src/i18n/routing.ts` + `src/i18n.ts` + add `messages/<locale>.json`.

## Documentation

- **Wiki**: [docs/](file:///c:/nilamit.com/docs/) — Architecture, API, and setup guides.
- **Onboarding**: [docs/onboarding/](file:///c:/nilamit.com/docs/onboarding/) — Audience-tailored guides for Contributors, Staff Engineers, Executives, and PMs.
- **Design System**: [docs/STYLE.md](file:///c:/nilamit.com/docs/STYLE.md) — Visual tokens, typography, and component patterns.
- **LLM Context**: [llms.txt](file:///c:/nilamit.com/llms.txt) — Project summary for coding agents.
- **AGENTS.md**: [AGENTS.md](file:///c:/nilamit.com/AGENTS.md) — Comprehensive instructions for coding agents.

---

## CRITICAL RULES — Never Violate

1. **Never write directly to Firestore from client components.** All writes go through Server Actions → Firebase Admin SDK. Security rules enforce `allow write: if false`.

2. **Never use `db.batch()` for operations with pre-read status checks.** Use `db.runTransaction()`. Batches have no read isolation.

3. **Never fail open on rate limiting for financial actions.** `bidLimiter` etc. already fail-closed in production — don't wrap in try/catch that passes on error.

4. **All admin gates must use `requireAdmin()` from `src/lib/admin-guard.ts`.** Never re-implement `ADMIN_EMAILS` check inline.

5. **OTP generation must use `crypto.randomInt()`.** Never `Math.random()`.

6. **All cron routes must be `POST`, not `GET`.** HTTP GET must be idempotent.

7. **Build-time packages must be in `dependencies`, not `devDependencies`.** Firebase App Hosting builds with `NODE_ENV=production` which omits devDependencies. Any package imported in CSS or source during the build must be in `dependencies`. Currently in `dependencies`: `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `shadcn`.

8. **After running `npm install`, always re-patch `@emnapi` in the lockfile** (see Known Issues below).

9. **After adding i18n keys to a component, add them to `messages/en.json`** under the correct namespace. Missing keys throw `MISSING_MESSAGE` exceptions that crash Server Components in production. (English-only deployment — see `src/i18n/routing.ts`.)

10. **Admin pages must check `isAdmin` and redirect before fetching data.** If `requireAdmin()` throws, Next.js shows a 500 error page. Always use `auth()` check + `redirect('/login')` at the top of admin Server Components.

11. **Authorized PII Gating** — Never return user phone numbers or emails in public actions or views. Use `AuctionService.getById(id, userId)` to gate sensitive data based on the viewer's role (seller or winner).

12. **Secure Uploads** — All image uploads must use the `/api/upload` endpoint (magic-byte + Cloud Vision SafeSearch validation). Never allow direct client-side storage uploads for user content. Auction images are served via 90-day signed URLs (revocable on object delete) — never call `makePublic()`.

13. **Logistics writes go through `src/lib/logistics.ts`, not Server Actions.** `createLogisticsOrder` takes pre-loaded addresses from a transaction; never re-export it as `'use server'`. Admin-only override is exposed via `src/actions/logistics.ts::updateLogisticsStatus()`.

14. **Refunds go through `adminRefundEscrow()` in `src/actions/dispute.ts`.** Single source of truth — validates escrow status, increments `defectCount`, writes to `admin_logs`, kicks off seller-performance recompute. `refundEscrow()` in `src/actions/escrow.ts` is a thin compat shim.

15. **Sentry-tag every error in a critical path.** `log.error()` accepts `area` + `severity` in its context; pass them whenever the failure should page someone. The alert rules in `docs/SENTRY_ALERTS.md` filter on these tags — a missing tag means the alert silently won't fire. Areas: `bid`, `escrow`, `auth`, `cron`, `upload`, `dispute`, `chat`, `logistics`, `admin`. Severities: `critical` (page), `warning` (slack), `info` (first-seen only).

---

## Architecture

```
Browser (React 19)
  ├── Client Components   → UI state, RTDB listeners, session reads
  └── Server Actions      → Auth gate, Zod validation, rate limit, business logic
       src/actions/*.ts
        ├── Domain Services   src/services/   → BiddingService, AuctionService
        └── Infrastructure    src/lib/
             ├── Firestore   (Admin SDK only — all writes)
             ├── RTDB        (real-time events after commits)
             ├── Upstash     (rate limiting — real creds in Secret Manager)
             └── Sentry      (EU region: ingest.de.sentry.io)
```

---

## Key File Map

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config, FirestoreAdapter, JWT/session callbacks |
| `src/lib/auth.config.ts` | Edge-safe NextAuth config — `pages.error: '/login'`, protected paths |
| `src/lib/admin-guard.ts` | `requireAdmin()` — single admin gate |
| `src/lib/db.ts` | Firestore proxy singleton, `docData()`, `snapDocs()`, `newId()` |
| `src/lib/firebase-admin.ts` | Admin SDK init (throws on missing creds), `rtdbPush()`, `rtdbSet()` |
| `src/lib/ratelimit.ts` | All rate limiters — fail-closed in production |
| `src/lib/schemas.ts` | All Zod schemas — add new ones here |
| `src/lib/auction-logic.ts` | `processAuctionSale()` — reserve check, commission, escrow, RTDB notify |
| `src/lib/errors.ts` | `ServiceResponse<T>`, `errorResponse()`, `successResponse()` |
| `src/lib/env.ts` | Zod env validation — `UPSTASH_REDIS_*` optional |
| `src/actions/bid.ts` | `placeBid()`, `executeBuyItNow()` |
| `src/actions/auction.ts` | `createAuction()`, `getAuctions()`, `getSpecializedFeeds()` |
| `src/actions/escrow.ts` | Escrow state transitions (all transactional) |
| `src/actions/admin.ts` | Admin stats/disputes/treasury — batch-hydrated |
| `src/actions/dispute.ts` | `raiseDispute()`, `resolveDispute()` — both transactional |
| `src/actions/report.ts` | `reportAuction()` — composite doc ID, transactional |
| `src/actions/chat.ts` | `sendMessage()` — validated, PII-filtered, stores buyerId/sellerId |
| `src/actions/review.ts` | Reviews — batch-fetched, reputation capped at 100 reviews |
| `src/actions/user.ts` | `updateProfile()` (validated), `getPublicProfile()` (count aggregations) |
| `src/middleware.ts` | Auth check, ban redirect, legacy `/en/*` → `/*` redirect |
| `src/app/admin/page.tsx` | Calls `requireAdmin()` + `redirect('/login')` before fetching |
| `src/app/admin/disputes/page.tsx` | Server-side admin gate; client at `AdminDisputesClient.tsx` |
| `src/app/api/cron/` | 5 cron routes — all POST, all `verifyCronSecret()` |
| `src/lib/logistics.ts` | Internal `server-only` module — caller must pass pre-loaded addresses |
| `src/lib/image-moderation.ts` | Cloud Vision SafeSearch wrapper — auto-skips when `IMAGE_MODERATION != "enabled"` |
| `src/app/api/cron/gc-uploads/` | Weekly GC for orphaned Storage objects |
| `.github/workflows/cron.yml` | The actual scheduler — all 5 cron jobs live here |
| `firestore.rules` | `allow write: if false` everywhere; `isAdmin` claim from `/api/firebase/token` |
| `firestore.indexes.json` | All composite indexes — update and `firebase deploy --only firestore:indexes` |
| `apphosting.yaml` | Firebase App Hosting config + secret mappings + `IMAGE_MODERATION` flag |
| `cloudbuild.yaml` | Build pipeline — uses `npm install` (not `npm ci`, see Known Issues) |
| `messages/en.json` | English translations — every `useTranslations` key must be defined here |
| `src/lib/logger.ts` | `log.info/warn/error/debug` — `error`/`warn` auto-capture to Sentry; pass `area` + `severity` in context to tag for alert rules |
| `src/lib/sentry-tags.ts` | `tagSentryArea(area, severity)` + `captureWithArea(err, area, severity)` — single source of truth for Sentry alert tags |
| `docs/SENTRY_ALERTS.md` | Canonical list of Sentry alert rules (must be created in the Sentry UI) |
| `src/app/api/sentry-test/route.ts` | Admin-only `GET ?area=&severity=` endpoint to verify alert rules end-to-end |

---

## Bidding Flow

```
placeBid(auctionId, amount)
  1. auth() + placeBidSchema.safeParse()
  2. bidLimiter.limit() — fail-closed
  3. requireBiddingPrivileges() — phone verified, not banned, not minor
  4. Elite deposit check (≥ ৳100,000)
  5. BiddingService.placeBid() →
       db.runTransaction()
         tx.get(auctionRef) ← locks auction doc
         validateBidPreconditions()
         computeAntiSnipeExtension() ← extends from endTime if < 2min left
         tx.set(bidRef)
         tx.update(auctionRef, { currentPrice, currentBidderId, endTime, bidCount })
       COMMIT → processAlertsAfterBid(), handleBidSideEffects() (async)
```

## Escrow State Machine

```
PENDING              → payEscrowAdvance()       → VERIFICATION_PENDING
VERIFICATION_PENDING → approveEscrowPayment()   → HELD          (admin; src/actions/admin/treasury.ts:81)
HELD                 → confirmItemReceived()    → RELEASED
HELD                 → markAsShipped()          → HELD          (status stays; sets deliveryStatus=SHIPPED)
HELD                 → raiseDispute()           → DISPUTED
HELD                 → adminRefundEscrow()      → REFUNDED      (admin; src/actions/dispute.ts)
PENDING              → adminRefundEscrow()      → REFUNDED      (admin)
VERIFICATION_PENDING → adminRefundEscrow()      → REFUNDED      (admin)
DISPUTED             → adminRefundEscrow()      → REFUNDED      (admin)
DISPUTED             → resolveDispute()         → RELEASED or REFUNDED   (admin)
```

`refundEscrow()` is a thin backwards-compat wrapper that delegates to
`adminRefundEscrow()` — never call it directly in new code.

---

## Secrets in Secret Manager (project: nilamit-52073)

| Secret | Status | Notes |
|---|---|---|
| `AUTH_SECRET` | ✓ Real | `aFOCaYn0TDGp6WA4Gi77noq0vu/S/LbFx5UT5GBkz9Q=` |
| `ADMIN_EMAILS` | ✓ Real | `sayemf21@gmail.com` |
| `CRON_SECRET` | ✓ Real | Auto-generated hex |
| `FIREBASE_PROJECT_ID` | ✓ Real | `nilamit-52073` |
| `FIREBASE_CLIENT_EMAIL` | ✓ Real | Firebase Admin SDK SA |
| `FIREBASE_PRIVATE_KEY` | ✓ Real | Firebase Admin SDK key |
| `FIREBASE_DATABASE_URL` | ✓ Real | RTDB URL |
| `FIREBASE_STORAGE_BUCKET` | ✓ Real | Storage bucket |
| `FIREBASE_WEB_API_KEY` | ✓ Real | Client SDK |
| `FIREBASE_MESSAGING_SENDER_ID` | ✓ Real | `884637735592` |
| `FIREBASE_APP_ID` | ✓ Real | Client SDK |
| `GOOGLE_CLIENT_ID` | ✓ Real | OAuth client |
| `GOOGLE_CLIENT_SECRET` | ✓ Real | Rotated May 4, 2026 |
| `SENTRY_DSN` | ✓ Real | EU region: `ingest.de.sentry.io` |
| `UPSTASH_REDIS_REST_URL` | ✓ Real | `https://safe-stallion-50421.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ Real | Real Upstash token |
| `GREENWEB_TOKEN` | ⚠️ Placeholder | `"console"` — OTPs log to stdout, not real SMS |
| `IMAGE_MODERATION` | env var | Set to `enabled` (May 2026); disable here to bypass Cloud Vision SafeSearch |

---

## Dashboard Tabs (current)

- **Watchlist** — saved auctions
- **Active Bids** — auctions user is currently bidding on
- **Won & Escrow** — completed wins and payment status
- **My Listings** — seller's own auctions
- **Coordination Hub** — post-sale buyer/seller chat (escrow-gated)
- ~~Seller Performance~~ — **removed** (not needed for C2C)

---

## Adding a New Server Action

```typescript
'use server';
import { auth } from '@/lib/auth';
import { mySchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function doSomething(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  const parsed = mySchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  try {
    await db.runTransaction(async (tx) => { /* ... */ });
    revalidatePath('/relevant-path');
    return successResponse(null);
  } catch (error) {
    log.error('[Action] doSomething failed', error);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}
```

## Adding i18n Keys

```typescript
// Component declares: const t = useTranslations('MyNamespace')
// Then calls: t('myKey')
```
Add to `messages/en.json`:
```json
// "MyNamespace": { "myKey": "English text" }
```
Missing keys throw `Error: MISSING_MESSAGE` in production and crash the page.

---

## Firestore Collections Reference

| Collection | Key fields |
|---|---|
| `users` | `isPhoneVerified`, `isBanned`, `reputationScore`, `isVerifiedSeller` |
| `auctions` | `status`, `currentPrice`, `currentBidderId`, `endTime`, `sellerId` |
| `bids` | `auctionId`, `bidderId`, `amount`, `createdAt` |
| `escrowTransactions` | `status`, `buyerId`, `auctionId` — doc ID = `auctionId` |
| `conversations` | `buyerId`, `sellerId`, `auctionId` — doc ID = `auctionId` |
| `messages` | `conversationId`, `senderId`, `buyerId`, `sellerId` |
| `disputes` | `transactionId`, `openerId`, `status` — doc ID = `transactionId` |
| `reports` | `auctionId`, `reporterId` — doc ID = `auctionId_reporterId` |
| `reviews` | `auctionId`, `fromId`, `toId` — doc ID = `fromId_auctionId` |
| `admin_logs` | `adminId`, `action`, `targetId` |
| `cronFailures` | `job`, `error`, `attempts` |

---

## Known Issues (handle carefully)

### `package-lock.json` is manually patched

Running `npm install` wipes the `@emnapi` entries. After any `npm install`, run:

```bash
node -e "
const fs = require('fs');
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
lock.packages['node_modules/@emnapi/runtime'] = { version:'1.10.0', resolved:'https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz', integrity:'sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==', optional:true, dependencies:{'@emnapi/core':'^1.4.3'} };
lock.packages['node_modules/@emnapi/core']    = { version:'1.10.0', resolved:'https://registry.npmjs.org/@emnapi/core/-/core-1.10.0.tgz',    integrity:'sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==',  optional:true, dependencies:{'@emnapi/runtime':'^1.4.3'} };
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2)+'\n');
"
```

Permanent fix: `docker run --rm -v $(pwd):/app -w /app node:20 npm install`

### `cloudbuild.yaml` uses `npm install` not `npm ci`

Firebase App Hosting's buildpack internally runs `npm ci`. Our `cloudbuild.yaml` runs `npm install` for the initial setup step. The buildpack's own `npm ci` is what actually installs for production — that's why the lockfile patch above matters.

### `GREENWEB_TOKEN` is a placeholder

SMS OTPs log to stdout. Get real token from greenweb.com.bd, update the secret, and add `SMS_PROVIDER=greenweb` to `apphosting.yaml`.

### Auth.js v5 beta

Monitor for stable release.

---

## Deployment Commands

```bash
# Deploy (push triggers auto-build)
git push origin main

# Manual rollout
firebase apphosting:rollouts:create nilamit --project nilamit-52073 --git-branch main

# Check builds
gcloud builds list --project=nilamit-52073 --region=asia-southeast1 --limit=3

# Get build log
gcloud builds log BUILD_ID --project=nilamit-52073 --region=asia-southeast1

# Set a secret
firebase apphosting:secrets:set SECRET_NAME --project nilamit-52073 --data-file -

# Grant secret access
firebase apphosting:secrets:grantaccess SECRET_NAME --project nilamit-52073 --backend nilamit

# Deploy Firestore indexes only
firebase deploy --only firestore:indexes --project nilamit-52073

# Health check
curl https://nilamit--nilamit-52073.asia-southeast1.hosted.app/api/health

# View errors
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --project=nilamit-52073 --limit=20
```

---

## Running Tests

```bash
npx vitest run       # 53 unit tests
npx tsc --noEmit     # 0 type errors
```
