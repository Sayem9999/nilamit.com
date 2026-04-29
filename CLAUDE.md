# CLAUDE.md — Nilamit Development Guide

This file is loaded automatically by Claude Code at the start of every session.

---

## What This Project Is

**nilamit.app** is a live production C2C auction marketplace for Bangladesh. Users list items, others bid in real-time, and the winner pays through an escrow system backed by bKash/Nagad mobile money. Bilingual: English + Bengali.

**Stack:** Next.js 16 App Router, Firebase (Firestore + RTDB + Storage + Auth), Auth.js v5, Upstash Redis, Sentry (EU region), Tailwind CSS 4.

**Deployed:** Firebase App Hosting (`nilamit` backend, project `nilamit-52073`). Push to `main` → auto-deploy via Cloud Build.

**Live URL:** `https://nilamit--nilamit-52073.asia-southeast1.hosted.app`

**Admin panel:** `/en/admin` — requires `isAdmin: true` in JWT (derived from `ADMIN_EMAILS` env var = `sayemf21@gmail.com`)

---

## Critical Rules — Never Violate These

1. **Never write directly to Firestore from client components.** All writes go through Server Actions → Firebase Admin SDK. Security rules enforce `allow write: if false` for all collections.

2. **Never use `db.batch()` for operations with pre-read status checks.** Use `db.runTransaction()`. Batches have no read isolation.

3. **Never fail open on rate limiting for financial actions.** `bidLimiter`, `authLimiter` etc. in `src/lib/ratelimit.ts` already fail-closed in production. Do not wrap them in `try/catch` that sets success to true on error.

4. **All admin gates must use `requireAdmin()` from `src/lib/admin-guard.ts`.** Never re-implement the `ADMIN_EMAILS` check inline.

5. **OTP generation must use `crypto.randomInt()`.** Never `Math.random()`.

6. **All cron routes must be `POST`, not `GET`.** HTTP GET must be idempotent; crons mutate state.

7. **Build-time packages must be in `dependencies`, not `devDependencies`.** Firebase App Hosting builds with `NODE_ENV=production` which omits devDependencies. Tailwind CSS, PostCSS, CSS animation libraries and any package imported in CSS/source must be in `dependencies`.

8. **After running `npm install`, always re-patch `@emnapi` in the lockfile.** The lockfile was patched manually (see Known Issues). Running `npm install` overwrites those entries.

9. **After adding i18n keys to a component, add them to both `messages/en.json` AND `messages/bn.json` under the correct namespace.** Missing keys cause `MISSING_MESSAGE` server errors on every page load. Check the namespace the component uses with `useTranslations('NamespaceHere')`.

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
             ├── Upstash     (rate limiting — real creds stored in Secret Manager)
             └── Sentry      (EU region: ingest.de.sentry.io)
```

---

## Key File Map

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config, FirestoreAdapter, JWT/session callbacks |
| `src/lib/auth.config.ts` | Edge-safe NextAuth config — `pages.error: '/login'`, admin protected paths |
| `src/lib/admin-guard.ts` | `requireAdmin()` — single admin gate, never duplicate |
| `src/lib/db.ts` | Firestore proxy singleton, `docData()`, `snapDocs()`, `newId()` |
| `src/lib/firebase-admin.ts` | Admin SDK init (throws on missing creds), `rtdbPush()`, `rtdbSet()` |
| `src/lib/ratelimit.ts` | All rate limiters — fail-closed in production |
| `src/lib/schemas.ts` | All Zod schemas — add new ones here, never inline |
| `src/lib/auction-logic.ts` | `processAuctionSale()` — reserve check, commission, escrow, RTDB notify |
| `src/lib/errors.ts` | `ServiceResponse<T>`, `errorResponse()`, `successResponse()` |
| `src/lib/env.ts` | Zod env validation — `UPSTASH_REDIS_*` optional (rate limiting degrades gracefully) |
| `src/lib/constants.ts` | `ERROR_CODES`, soft-close constants |
| `src/services/bidding/bidding-service.ts` | `BiddingService.placeBid()` — the atomic bid transaction |
| `src/services/bidding/bid-rules.ts` | `validateBidPreconditions()`, `computeAntiSnipeExtension()` |
| `src/services/auction/auction-service.ts` | `AuctionService.list()`, `AuctionService.getById()` |
| `src/actions/bid.ts` | `placeBid()`, `executeBuyItNow()` |
| `src/actions/auction.ts` | `createAuction()`, `getAuctions()`, `getSpecializedFeeds()` |
| `src/actions/escrow.ts` | Escrow state transitions (all transactional) |
| `src/actions/admin.ts` | Admin stats/disputes/treasury — uses `batchHydrateEscrowRows()` |
| `src/actions/dispute.ts` | `raiseDispute()`, `resolveDispute()` — both transactional |
| `src/actions/report.ts` | `reportAuction()` — composite doc ID, transactional uniqueness |
| `src/actions/chat.ts` | `sendMessage()` — validated, PII-filtered, stores buyerId/sellerId |
| `src/actions/review.ts` | Reviews — batch-fetched, reputation capped at 100 reviews |
| `src/actions/user.ts` | `updateProfile()` (validated), `getPublicProfile()` (count aggregations) |
| `src/middleware.ts` | Auth check, ban redirect, i18n routing, locale stripping for API |
| `src/app/[locale]/admin/page.tsx` | Admin page — checks `isAdmin` before fetching, redirects to `/login` |
| `src/app/api/cron/` | 4 cron routes — all POST, all `verifyCronSecret()` |
| `src/app/api/upload/route.ts` | Image upload — magic-byte validated, rate-limited |
| `firestore.rules` | Security rules — `allow write: if false` everywhere |
| `apphosting.yaml` | Firebase App Hosting config + all 16 secret mappings |
| `cloudbuild.yaml` | Build pipeline — `npm install` (not `npm ci`, see Known Issues) |
| `messages/en.json` | English translations — all components must have keys here |
| `messages/bn.json` | Bengali translations — must mirror en.json structure |

---

## Bidding Flow (most critical path)

```
placeBid(auctionId, amount)
  1. auth() — require session
  2. placeBidSchema.safeParse() — validate inputs
  3. bidLimiter.limit() — 60/60s per user+IP, fail-closed
  4. requireBiddingPrivileges() — phone verified, not banned, not minor
  5. Elite deposit check (≥ ৳100,000)
  6. BiddingService.placeBid() →
       db.runTransaction()
         tx.get(auctionRef)       ← locks auction doc
         validateBidPreconditions()
         computeAntiSnipeExtension() ← extends from endTime if < 2min left
         tx.set(bidRef)
         tx.update(auctionRef, { currentPrice, currentBidderId, endTime, bidCount })
       COMMIT
       processAlertsAfterBid()   ← post-tx, deactivate TARGET_REACHED
       handleBidSideEffects()    ← RTDB, email, FCM, badges (all async)
```

## Escrow State Machine

```
PENDING → payEscrowAdvance()       → HELD
HELD    → confirmItemReceived()    → RELEASED
HELD    → raiseDispute()           → DISPUTED
HELD    → refundEscrow() (admin)   → REFUNDED
HELD    → resolveAdminDispute()    → RELEASED or REFUNDED
DISPUTED→ resolveAdminDispute()    → RELEASED or REFUNDED
```

---

## Secrets in Secret Manager (project: nilamit-52073)

All 16 secrets stored. Manage with:
```bash
firebase apphosting:secrets:set SECRET_NAME --project nilamit-52073 --data-file -
firebase apphosting:secrets:grantaccess SECRET_NAME --project nilamit-52073 --backend nilamit
```

| Secret | Status | Notes |
|---|---|---|
| `AUTH_SECRET` | ✓ Real | Updated to user-provided value |
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
| `GOOGLE_CLIENT_SECRET` | ⚠️ Rotate | Old value from `.env` was leaked |
| `SENTRY_DSN` | ✓ Real | EU region DSN |
| `UPSTASH_REDIS_REST_URL` | ✓ Real | `https://safe-stallion-50421.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ Real | Real Upstash token |
| `GREENWEB_TOKEN` | ⚠️ Placeholder | `"console"` — update with real SMS token |

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

Every new string in a component must go in BOTH message files:

```typescript
// Component uses: const t = useTranslations('MyNamespace')
// Then calls: t('myKey')
```

```json
// messages/en.json  — add under "MyNamespace": { "myKey": "English text" }
// messages/bn.json  — add under "MyNamespace": { "myKey": "বাংলা টেক্সট" }
```

Missing keys throw `MISSING_MESSAGE` server errors visible in Cloud Run logs.

---

## Firestore Collections Reference

| Collection | Key fields | Notes |
|---|---|---|
| `users` | `isPhoneVerified`, `isBanned`, `reputationScore`, `isVerifiedSeller` | All writes via Admin SDK |
| `auctions` | `status`, `currentPrice`, `currentBidderId`, `endTime`, `sellerId` | `currentBidderId` denormalized for bid transactions |
| `bids` | `auctionId`, `bidderId`, `amount`, `createdAt` | Public read |
| `escrowTransactions` | `status`, `buyerId`, `auctionId`, `amount` | Doc ID = `auctionId` (idempotent) |
| `conversations` | `buyerId`, `sellerId`, `auctionId` | Doc ID = `auctionId` |
| `messages` | `conversationId`, `senderId`, `buyerId`, `sellerId`, `content` | `buyerId`/`sellerId` denormalized for rules |
| `disputes` | `transactionId`, `openerId`, `status`, `reason` | Doc ID = `transactionId` (idempotent) |
| `reports` | `auctionId`, `reporterId`, `reason`, `status` | Doc ID = `auctionId_reporterId` (idempotent) |
| `reviews` | `auctionId`, `fromId`, `toId`, `rating` | Doc ID = `fromId_auctionId` (idempotent) |
| `alerts` | `userId`, `auctionId`, `type`, `isActive`, `thresholdPrice` | Deactivated post-bid |
| `admin_logs` | `adminId`, `action`, `targetId` | Audit trail |
| `cronFailures` | `job`, `error`, `attempts` | Operator review queue |

---

## RTDB Paths

```
bids/auction/{id}            latest bid state (overwrite — rtdbSet)
activity/auction/{id}        bid history feed (append — rtdbPush)
notifications/user/{id}      per-user inbox (append)
chat/conversation/{id}       messages (append)
presence/auction/{id}/{uid}  viewer presence (client writes own entry)
```

---

## Known Issues (handle carefully)

### `package-lock.json` is manually patched
The lockfile has manually-injected entries for `@emnapi/runtime@1.10.0` and `@emnapi/core@1.10.0` with npm registry integrity hashes. These are wasm32 optional deps of `vitest→vite→rolldown`. Windows npm skips wasm32 packages, so they never get hoisted entries. Firebase App Hosting's Linux buildpack requires them.

**Every time you run `npm install`, you must re-patch the lockfile:**
```bash
node -e "
const fs = require('fs');
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
lock.packages['node_modules/@emnapi/runtime'] = { version:'1.10.0', resolved:'https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz', integrity:'sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==', optional:true, dependencies:{'@emnapi/core':'^1.4.3'} };
lock.packages['node_modules/@emnapi/core']    = { version:'1.10.0', resolved:'https://registry.npmjs.org/@emnapi/core/-/core-1.10.0.tgz',    integrity:'sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==',  optional:true, dependencies:{'@emnapi/runtime':'^1.4.3'} };
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2)+'\n');
console.log('emnapi patched');
"
```
Permanent fix: `docker run --rm -v $(pwd):/app -w /app node:20 npm install` then commit.

### Build-time packages must be in `dependencies`
Firebase App Hosting runs `npm ci` with `NODE_ENV=production`, omitting devDependencies. Any package imported in CSS or source code during build must be in `dependencies`:
- `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `shadcn` — all in `dependencies` ✓

### Auth.js v5 beta
Monitor for stable release. No code change needed until then.

### Email OTPs in plaintext
`verificationTokens` collection stores OTP tokens in plaintext (Auth.js adapter convention). 5-min TTL is the mitigation.

### GREENWEB_TOKEN is placeholder
SMS OTPs currently log to stdout. Get token from greenweb.com.bd, update secret, add `SMS_PROVIDER=greenweb` to `apphosting.yaml`.

### GOOGLE_CLIENT_SECRET needs rotation
The old value (`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`) was in the `.env` file which may have been committed. Rotate at `console.cloud.google.com/apis/credentials`.

---

## Deployment Commands

```bash
# Trigger deploy (push to main)
git push origin main

# Manual rollout
firebase apphosting:rollouts:create nilamit --project nilamit-52073 --git-branch main

# Check build status
gcloud builds list --project=nilamit-52073 --region=asia-southeast1 --limit=3

# Get build logs
gcloud builds log BUILD_ID --project=nilamit-52073 --region=asia-southeast1

# Set a secret
firebase apphosting:secrets:set SECRET_NAME --project nilamit-52073 --data-file -

# Grant secret access to App Hosting
firebase apphosting:secrets:grantaccess SECRET_NAME --project nilamit-52073 --backend nilamit

# Health check
curl https://nilamit--nilamit-52073.asia-southeast1.hosted.app/api/health

# View errors
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --project=nilamit-52073 --limit=20
```

---

## Running Tests

```bash
npx vitest run          # 53 unit tests passing
npx tsc --noEmit        # 0 type errors
```
