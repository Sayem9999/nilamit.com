# CLAUDE.md — Nilamit Development Guide

This file is loaded automatically by Claude Code at the start of every session.

---

## What This Project Is

**nilamit.app** is a production C2C auction marketplace for Bangladesh. Users list items, others bid in real-time, and the winner pays through an escrow system backed by bKash/Nagad mobile money. Bilingual: English + Bengali.

**Stack:** Next.js 16 App Router, Firebase (Firestore + RTDB + Storage + Auth), Auth.js v5, Upstash Redis, Sentry (EU region), Tailwind CSS 4.

**Deployed:** Firebase App Hosting (`nilamit` backend, project `nilamit-52073`). Push to `main` → auto-deploy.

**Live URL:** `https://nilamit--nilamit-52073.asia-southeast1.hosted.app`

---

## Critical Rules — Never Violate These

1. **Never write directly to Firestore from client components.** All writes go through Server Actions → Firebase Admin SDK. Security rules enforce `allow write: if false` for all collections.

2. **Never use `db.batch()` for operations with pre-read status checks.** Use `db.runTransaction()`. Batches have no read isolation — a concurrent write could slip through a status check between read and write.

3. **Never fail open on rate limiting for financial actions.** The `bidLimiter`, `authLimiter` etc. in `src/lib/ratelimit.ts` already fail-closed in production. Do not wrap them in `try/catch` that sets success to true on error.

4. **All admin gates must use `requireAdmin()` from `src/lib/admin-guard.ts`.** Never re-implement the `ADMIN_EMAILS` check inline — the guard normalizes email case, inline checks often don't.

5. **OTP generation must use `crypto.randomInt()`.** Never `Math.random()`.

6. **Payment references must use `randomUUID()`.** Never `Math.random().toString(36)`.

7. **All cron routes must be `POST`, not `GET`.** HTTP GET must be idempotent; crons mutate state.

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
             ├── Upstash     (rate limiting, fail-closed)
             └── Sentry      (EU region: ingest.de.sentry.io)
```

---

## Key File Map

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config, FirestoreAdapter, JWT/session callbacks |
| `src/lib/auth.config.ts` | Edge-safe NextAuth config (used in middleware) |
| `src/lib/admin-guard.ts` | `requireAdmin()` — single admin gate, never duplicate |
| `src/lib/db.ts` | Firestore proxy singleton, `docData()`, `snapDocs()`, `newId()` |
| `src/lib/firebase-admin.ts` | Admin SDK init (throws on missing creds), `rtdbPush()`, `rtdbSet()` |
| `src/lib/ratelimit.ts` | All rate limiters — fail-closed in production, fail-open in dev |
| `src/lib/schemas.ts` | All Zod schemas — add new ones here, never inline |
| `src/lib/auction-logic.ts` | `processAuctionSale()` — reserve check, commission, escrow, RTDB notify |
| `src/lib/errors.ts` | `ServiceResponse<T>`, `errorResponse()`, `successResponse()` |
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
| `src/app/api/cron/` | 4 cron routes — all POST, all `verifyCronSecret()` |
| `src/app/api/upload/route.ts` | Image upload — magic-byte validated, rate-limited |
| `firestore.rules` | Security rules — `allow write: if false` everywhere |
| `apphosting.yaml` | Firebase App Hosting config + all 14 secret mappings |
| `cloudbuild.yaml` | Build pipeline — `npm ci` (lockfile must be Linux-compatible) |

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

## Adding a New Server Action

```typescript
'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { mySchema, formatZodError } from '@/lib/schemas'; // add schema to schemas.ts
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

## Adding a New Cron Route

```typescript
// src/app/api/cron/my-job/route.ts
import { verifyCronSecret, withRetry, cronSuccess, cronError } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    // job logic
    return { processed: 0 };
  }, { maxAttempts: 3 });

  if (result.error) {
    log.error('[Cron] my-job failed', result.error);
    return cronError(`my-job failed: ${result.error.message}`);
  }
  return cronSuccess(result.data!);
}
```

Then register in `scripts/setup-cloud-scheduler.sh` as `--http-method=POST`.

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
| `phoneVerifications` | `phone`, `otp` (SHA-256 hash), `expiresAt` | OTP consumed on verify |
| `verificationTokens` | `identifier`, `token` (plaintext), `expires` | Doc ID = SHA-256(`identifier:token`) |
| `admin_logs` | `adminId`, `action`, `targetId` | Audit trail |
| `cronFailures` | `job`, `error`, `attempts` | Operator review queue |

---

## RTDB Paths

```
bids/auction/{id}            latest bid state (overwrite — rtdbSet)
activity/auction/{id}        bid history feed (append — rtdbPush)
activity/global              homepage ticker (append)
notifications/user/{id}      per-user inbox (append)
chat/conversation/{id}       messages (append)
presence/auction/{id}/{uid}  viewer presence (client writes own entry)
```

---

## Known Issues / Gotchas

- **`package-lock.json` was manually patched** with `@emnapi/runtime@1.10.0` and `@emnapi/core@1.10.0` entries. These are wasm32 optional deps of `vitest→vite→rolldown`. Regenerate properly with `docker run --rm -v $(pwd):/app -w /app node:20 npm install` when Docker is available.
- **Auth.js v5 is beta.** Monitor for stable release.
- **Email OTPs stored in plaintext** in `verificationTokens` — Auth.js adapter convention. 5-min TTL is the mitigation.
- **`GREENWEB_TOKEN` is a placeholder** (`"console"`). Real SMS requires updating this secret and adding `SMS_PROVIDER=greenweb` to `apphosting.yaml`.
- **Admin emails** in Secret Manager: `sayemf21@gmail.com`. Update via `firebase apphosting:secrets:set ADMIN_EMAILS`.
- **Firestore rules `get()` in messages** was removed by denormalizing `buyerId`/`sellerId` onto message docs in `sendMessage()`. Old messages (pre-deploy) don't have these fields — they'll fail the new rule until re-sent.
- **`EMAIL_REGEX` in pii-filter** has `g` flag — use `EMAIL_REGEX_TEST` (no flag) for `.test()` calls or you'll get alternating false negatives.
- **`placeBidSchema` validates at action boundary** but `BiddingService.placeBid()` also validates inside the transaction. Both are intentional — different layers.
- **`computeAntiSnipeExtension` extends from `endTime`, not `now`** — this is intentional to prevent a bidder from shortening the auction by bidding early in the soft-close window.

---

## Deployment

One-command deploy: `./scripts/deploy.sh` (fill in 3 values at top).

Fix build issues: `./scripts/fix-build.sh`

All secrets managed via: `firebase apphosting:secrets:set SECRET_NAME --project nilamit-52073`

Grant secret access: `firebase apphosting:secrets:grantaccess SECRET_NAME --project nilamit-52073 --backend nilamit`

Monitor builds: `https://console.firebase.google.com/project/nilamit-52073/apphosting`

Trigger manual rollout: `firebase apphosting:rollouts:create nilamit --project nilamit-52073 --git-branch main`

Health check: `curl https://nilamit--nilamit-52073.asia-southeast1.hosted.app/api/health`

---

## Running Tests

```bash
npx vitest run          # unit tests (53 passing)
npx tsc --noEmit        # type check (0 errors)
npx playwright test     # e2e tests
```
