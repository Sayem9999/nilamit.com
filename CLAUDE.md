# CLAUDE.md — Nilamit Development Guide

This file is loaded automatically by Claude Code at the start of every session.

---

## What This Project Is

**nilamit.app** is a live production C2C auction marketplace for Bangladesh. Users list items, others bid in real-time, and the winner pays through an escrow system backed by bKash/Nagad mobile money (with SSLCommerz card/net-banking as an additional gateway when configured).

**Stack:** Next.js 16 App Router, Firebase (Firestore + RTDB + Storage + Auth + FCM + Remote Config), Auth.js v5, Upstash Redis, Sentry (EU region), Tailwind CSS 4, Zustand (UI store), TanStack Query (client fetches), BigQuery (analytics sink), SSLCommerz (card/net-banking gateway, env-gated). **No third-party search service** — Firestore-only search via `src/actions/search.ts`.

**Deployed:** Firebase App Hosting (`nilamit` backend, project `nilamit-52073`). Push to `main` → auto-deploy via Cloud Build.

**Live URL:** `https://www.nilamit.com`

**Admin panel:** `/admin` — gated by `requireAdmin()` in [src/lib/admin-guard.ts](src/lib/admin-guard.ts) (DB-deep check, not JWT-only). Admin emails come from the `ADMIN_EMAILS` secret (in Secret Manager — not listed here).

**Cron:** GitHub Actions workflow in [.github/workflows/cron.yml](.github/workflows/cron.yml) hits the `/api/cron/*` + `/api/tasks/*` POST endpoints with `Bearer ${CRON_SECRET}`. There is **no** Cloud Scheduler. Jobs: `close-auctions` + `process-alerts` (every 5 min), `closing-soon` + `saved-search-matches` (every 15 min), `enforce-policies` (hourly), `backup` (daily 03:00 UTC — managed Firestore export to GCS, env-gated on `BACKUP_GCS_BUCKET`), `gc-uploads` (weekly Sun 04:00 UTC).

**Android APK:** [.github/workflows/android-apk.yml](.github/workflows/android-apk.yml) builds a signed TWA APK (Bubblewrap → direct Gradle build with AGP injected signing) and publishes it to `public/downloads/nilamit.apk` (served by the in-app install UI). Trigger: manual dispatch or `v*` tag. Requires `ANDROID_KEYSTORE_BASE64` + `ANDROID_KEYSTORE_PASSWORD` + `ANDROID_KEY_PASSWORD` repo secrets. See [docs/MOBILE.md](docs/MOBILE.md). The PWA itself (manifest + `public/sw.js` + `InstallAppButton`) is the cross-platform installable app.

**i18n:** English + Bengali. Cookie-driven (`NEXT_LOCALE`); no URL prefix to keep SEO stable. Switch via `<LocaleSwitcher />` in the navbar utility row — it calls `setLocale` Server Action which sets the cookie + revalidates the layout. The Navigation namespace in `messages/bn.json` is fully translated; remaining namespaces are seeded from `en.json` (drop-in translations as you go — no MISSING_MESSAGE crashes). Add another locale = update `src/i18n/routing.ts` + `src/i18n.ts` + ship `messages/<locale>.json` + extend `LocaleSwitcher`.

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

14. **Refunds go through `adminRefundEscrow()` in `src/actions/dispute.ts`.** Single source of truth — validates escrow status, increments `defectCount`, writes to `admin_logs`, kicks off seller-performance recompute. `refundEscrow()` in `src/actions/esc  15. **Sentry-tag every error in a critical path.** `log.error()` accepts `area` + `severity` in its context; pass them whenever the failure should page someone. The alert rules in `docs/SENTRY_ALERTS.md` filter on these tags — a missing tag means the alert silently won't fire. Areas: `bid`, `escrow`, `auth`, `cron`, `upload`, `dispute`, `chat`, `logistics`, `admin`. Severities: `critical` (page), `warning` (slack), `info` (first-seen only).
  
  16. **Global Security Headers** — `middleware.ts` enforces CSP, HSTS, and Frame protection. Always verify new scripts/domains against the CSP whitelist.
  
  17. **High-Scalability Services** — For large features (Auction, Bidding), use the **Modular Service Pattern**: split into `modules/reader`, `modules/writer`, and `modules/notifier`.

  18. **Data Purity & Live Database Integrity** — Never return mock/seed array values on live production files, showcase pages, or server actions. If no data exists, let the client component gracefully degrade, render a clean empty state, or hide the section entirely. Mocks belong only in unit testing environments.

---

## Architecture

```
Browser (React 19)
  ├── Client Components   → UI state, RTDB listeners, session reads
  └── Server Actions      → Auth gate, Zod validation, rate limit, business logic
       src/actions/*.ts
        ├── Domain Services   src/services/   → BiddingService, AuctionService
        │    └── Modules      src/services/*/modules/ → Split by Query/Command/Event
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
| `src/lib/auth.ts` | NextAuth config, FirestoreAdapter, JWT/session callbacks (Rate limited) |
| `src/lib/auth.config.ts` | Edge-safe NextAuth config — `pages.error: '/login'`, protected paths |
| `src/lib/admin-guard.ts` | `requireAdmin()` — single admin gate with DB-deep check |
| `src/lib/db.ts` | Firestore proxy singleton, `docData()`, `snapDocs()`, `newId()` |
| `src/lib/firebase-admin.ts` | Admin SDK init, `rtdbPush()`, `rtdbSet()` |
| `src/lib/ratelimit.ts` | Upstash rate limiters — fail-closed in production |
| `src/lib/schemas.ts` | All Zod schemas — single source of truth |
| `src/lib/errors.ts` | `ServiceResponse<T>`, `errorResponse()`, `successResponse()` |
| `src/services/auction/` | Modular Auction logic (Reader, Writer, Notifier) |
| `src/services/bidding/` | Modular Bidding logic (Processor, SideEffects) |
| `src/actions/bid.ts` | Server actions for bidding — entry points |
| `src/actions/auction.ts` | Server actions for auction management |
| `src/middleware.ts` | Security headers (CSP, HSTS), Auth check, Ban redirect |
| `src/lib/logger.ts` | `log.info/warn/error/debug` → Sentry; `log.event(type, fields)` → BigQuery sink (no-op without env). |
| `src/lib/firebase-remote-config.ts` | Runtime feature flags. Priority order: Remote Config > SystemConfig (Firestore) > hard-coded default. Defaults defined in `RemoteConfigDefaults`. |
| `src/lib/fcm.ts` | Browser FCM client — `enablePushNotifications()` from a user gesture; `onForegroundPush()` for in-tab toasts. No-ops without `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. |
| `src/lib/fcm-sender.ts` | Server `pushToUser(userId, payload)` via `firebase-admin/messaging`. Auto-prunes invalid tokens. Wired into `BidSideEffects.notifyOutbid` and `notifySeller`. |
| `public/firebase-messaging-sw.js` | SW for background push display + click-through deep-link. Hard-codes the public Firebase config (SW can't read `process.env`). |
| `src/app/api/payments/callback/route.ts` | Single payment webhook for all gateways — verifies SSLCommerz hash for production form-POSTs, or accepts a dev-test JSON body with `PAYMENT_WEBHOOK_SECRET`. Delegates to `PaymentService.verifyAndReleaseEscrow` which transactionally flips escrow PENDING → HELD. **Do NOT add a separate sslcommerz/* route** — that's the dead code we removed. |
| `src/lib/bigquery-shipper.ts` | Streaming insert. Schema documented inline. |
| `src/stores/ui-store.ts` | Zustand store (theme/locale/lightweightMode/sidebar/tipsSeen) persisted to localStorage. |
| `src/components/providers/QueryProvider.tsx` | TanStack Query client — 30s stale, 1 retry, refetchOnWindowFocus on. |
| `src/components/layout/LocaleSwitcher.tsx` | EN \| বাং toggle in the navbar utility row. |
| `src/actions/locale.ts` | Server Action: writes `NEXT_LOCALE` cookie + `revalidatePath('/', 'layout')`. |
| `src/app/api/fcm/register/route.ts` | POST endpoint to persist a FCM token onto `users/{uid}.fcmTokens[]`. |

---

## Bidding Flow

```
placeBid(auctionId, amount)
  1. auth() + placeBidSchema.safeParse()
  2. bidLimiter.limit() — fail-closed (Upstash)
  3. requireBiddingPrivileges() — cached verify
  4. BiddingService.placeBid() →
       BidProcessor.placeBid() (Transaction)
         tx.get(auctionRef) ← locks auction doc
         validateBidPreconditions()
         computeAntiSnipeExtension()
         Proxy Bidding Logic (Competitive)
         tx.set(bidRef)
         tx.update(auctionRef, { currentPrice, currentBidderId, endTime, bidCount })
       COMMIT → BidSideEffects.handleBidSideEffects() (Async RTDB + Notifiers)
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
| `AUTH_SECRET` | ✓ Real | Value lives ONLY in Secret Manager — never commit it. (Rotated after a repo-visibility exposure; old value is burned.) |
| `ADMIN_EMAILS` | ✓ Real | In Secret Manager. Do not list admin addresses in source. |
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
| `UPSTASH_REDIS_REST_URL` | ✓ Real | In Secret Manager. |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ Real | Real Upstash token |
| `IMAGE_MODERATION` | env var | Set to `enabled` (May 2026); disable here to bypass Cloud Vision SafeSearch |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | ✓ Real | Activated. Public Web Push certificate from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates. Powers FCM browser push in `src/lib/fcm.ts`. |
| `SSLCOMMERZ_STORE_ID` | secret | Enables the SSLCommerz gateway alongside bKash/Nagad. Without it `/api/payments/sslcommerz/init` returns 503; other gateways unaffected. |
| `SSLCOMMERZ_STORE_PASSWORD` | secret | Signs init requests and verifies IPN hashes. |
| `SSLCOMMERZ_SANDBOX` | env var | `"true"` for sandbox; otherwise production. |
| `BIGQUERY_DATASET` | env var | Dataset name (e.g. `nilamit_events`). Without it `log.event()` no-ops, so callers don't need null-checks. |
| `BIGQUERY_TABLE` | env var | Defaults to `events`. Schema: `event_id STRING REQUIRED, event_type STRING REQUIRED, ts TIMESTAMP REQUIRED, user_id STRING, auction_id STRING, amount_bdt INT64, metadata JSON`. |
| `GCP_PROJECT_ID` | env var | Falls back to `FIREBASE_PROJECT_ID`. Used by BigQuery client. |
| `BACKUP_GCS_BUCKET` | env var | `nilamit-52073-backups` (US, matches the `(default)` nam5 DB). Enables daily managed Firestore export via `/api/cron/backup`. Without it the cron no-ops. SA `firebase-adminsdk-fbsvc` has `datastore.importExportAdmin` + bucket `storage.objectAdmin`; 30-day object lifecycle. |

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
curl https://www.nilamit.com/api/health

# View errors
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --project=nilamit-52073 --limit=20
```

---

## CLI & Cloud Environment Access

The local workspace has active, pre-authenticated, and fully authorized CLI toolchains. Agents have direct execution access to:
1. **Google Cloud SDK (`gcloud`)**: Fully authenticated for project `nilamit-52073`. You can query container logs (`gcloud logging read`), list services (`gcloud run services list`), or fetch Cloud Build states directly.
2. **Firebase CLI (`firebase`)**: Configured to deploy database indexes, rules (`firebase deploy --only firestore`), or manage App Hosting rollout environments.
3. **Local PowerShell & Git**: Fully enabled to stage, format check, commit, and securely push changes to remote repositories for automated container delivery.

---

## Running Tests

```bash
npx vitest run       # 60 unit tests
npx tsc --noEmit     # 0 type errors
```
