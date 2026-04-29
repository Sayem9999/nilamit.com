# CLAUDE.md — Nilamit Development Guide

This file is loaded automatically by Claude Code at the start of every session. It contains everything needed to work on this codebase without re-deriving context.

---

## What This Project Is

**nilamit.app** is a production C2C auction marketplace for Bangladesh. Users list items, others bid in real-time, and the winner pays through an escrow system backed by bKash/Nagad mobile money. The platform is in Bengali and English.

**Stack:** Next.js 16 App Router, Firebase (Firestore + RTDB + Storage + Auth), Auth.js v5, Upstash Redis, Sentry, Tailwind CSS 4.

**Deployed on:** Firebase App Hosting (Google Cloud Run). Push to `main` → auto-deploy. No manual deploy commands needed.

---

## Critical Rules

1. **Never write directly to Firestore from client components.** All writes go through Server Actions → Firebase Admin SDK. The Firestore security rules enforce `allow write: if false` for all collections except through Admin SDK.

2. **Never use `db.batch()` for operations that modify auction state.** Use `db.runTransaction()`. Batches are not atomic reads — a concurrent bid could read stale state and both succeed.

3. **Never fail open on rate limiting for financial actions.** The `bidLimiter`, `authLimiter` etc. in `src/lib/ratelimit.ts` already fail-closed in production. Don't wrap them in `try/catch` that sets success to true on error.

4. **All admin gates must use `requireAdmin()` from `src/lib/admin-guard.ts`** — never re-implement the ADMIN_EMAILS check inline. The guard normalizes email case; inline implementations often don't.

5. **OTP generation must use `crypto.randomInt()`** — never `Math.random()`.

6. **Payment references must use `randomUUID()`** — never `Math.random().toString(36)`.

---

## Architecture in One Page

```
Browser
  └── React Client Components (hooks, UI state)
       └── Server Actions (src/actions/)        ← authentication gate, input validation
            └── Domain Services (src/services/) ← business logic, Firestore transactions
                 └── Firebase Admin SDK         ← all DB writes
                      └── Firestore             ← source of truth
                      └── RTDB                  ← real-time events (bids, notifications)
```

**Server Actions** (`src/actions/`) are thin controllers: check auth, run Zod validation, call services, revalidate paths. They do NOT contain business logic.

**Services** (`src/services/`) contain all business logic: `BiddingService.placeBid()`, `AuctionService.list()`. These are isolated from the HTTP layer and can be called from cron jobs too.

**Lib** (`src/lib/`) is infrastructure: `auth.ts` (NextAuth config), `db.ts` (Firestore proxy), `ratelimit.ts` (Upstash), `auction-logic.ts` (sale finalization), `admin-guard.ts`, `schemas.ts` (Zod), `sanitizer.ts`, `pii-filter.ts`.

---

## Bidding Flow (most critical path)

```
placeBid(auctionId, amount) [src/actions/bid.ts]
  1. auth() — require session
  2. bidLimiter.limit() — Upstash rate check (fail-closed)
  3. requireBiddingPrivileges() — phone verified, not banned, not minor
  4. Elite deposit check if amount >= 100,000 BDT
  5. BiddingService.placeBid() [src/services/bidding/bidding-service.ts]
     a. db.runTransaction()
        - tx.get(auctionRef) — lock auction doc
        - validateBidPreconditions() — status, endTime, self-bid, minimum amount
        - computeAntiSnipeExtension() — extend 2min if bid in last 2min
        - tx.set(bidRef, ...) — create bid
        - tx.update(auctionRef, { currentPrice, currentBidderId, endTime })
     b. processAlertsAfterBid() — deactivate TARGET_REACHED alerts (post-tx)
     c. handleBidSideEffects() — RTDB events, email, FCM, badge award (async)
```

**Auction close flow** (cron):
```
POST /api/cron/close-auctions (or /api/cron/process-auctions — both identical now)
  → closeAllEndedAuctions() [src/lib/auction-logic.ts]
       → closeAuctionIfEnded(id) per auction
            → db.runTransaction()
                 → processAuctionSale() — sets SOLD, calculates commission, creates escrow PENDING
                      → sendAuctionWonEmail() + rtdbPush(AUCTION_WON)
```

---

## Escrow State Machine

```
PENDING  → buyer calls payEscrowAdvance()   → HELD
HELD     → buyer calls confirmItemReceived() → RELEASED
HELD     → buyer calls raiseDispute()        → DISPUTED
HELD     → admin calls refundEscrow()        → REFUNDED
HELD     → admin calls resolveAdminDispute() → RELEASED or REFUNDED
DISPUTED → admin calls resolveAdminDispute() → RELEASED or REFUNDED
```

Seller marks shipped (no state change, sets `deliveryStatus: 'SHIPPED'` on auction) while escrow stays HELD.

---

## File Map (key files only)

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config, FirestoreAdapter, JWT/session callbacks |
| `src/lib/auth.config.ts` | Edge-safe NextAuth config (used in middleware) |
| `src/lib/admin-guard.ts` | `requireAdmin()` — single admin gate |
| `src/lib/db.ts` | Firestore proxy singleton, `docData()`, `snapDocs()`, `newId()` |
| `src/lib/firebase-admin.ts` | Admin SDK init, `rtdbPush()`, `rtdbSet()` |
| `src/lib/firebase-client.ts` | Client SDK (auth, storage, analytics) |
| `src/lib/ratelimit.ts` | All rate limiters — fail-closed in production |
| `src/lib/schemas.ts` | Zod schemas for all trust-boundary inputs |
| `src/lib/auction-logic.ts` | `processAuctionSale()`, `closeAuctionIfEnded()` |
| `src/lib/sanitizer.ts` | XSS sanitization via DOMPurify |
| `src/lib/pii-filter.ts` | Phone/email/keyword redaction |
| `src/lib/env.ts` | Zod env validation — validated on startup |
| `src/lib/errors.ts` | `ServiceResponse<T>`, `errorResponse()`, `successResponse()` |
| `src/lib/constants.ts` | `ERROR_CODES`, soft-close window/extension constants |
| `src/services/bidding/bidding-service.ts` | `BiddingService.placeBid()` |
| `src/services/bidding/bid-rules.ts` | `validateBidPreconditions()`, `computeAntiSnipeExtension()` |
| `src/services/auction/auction-service.ts` | `AuctionService.list()`, `AuctionService.getById()` |
| `src/actions/bid.ts` | `placeBid()`, `executeBuyItNow()` |
| `src/actions/auction.ts` | `createAuction()`, `getAuctions()`, `getSpecializedFeeds()` |
| `src/actions/escrow.ts` | Escrow state transitions |
| `src/actions/admin.ts` | Admin stats, disputes, treasury — all use `batchHydrateEscrowRows()` |
| `src/actions/auth.ts` | `registerUser()`, `signupWithPhone()`, `resetPasswordWithOTP()` |
| `src/middleware.ts` | Auth check, ban redirect, i18n routing, locale stripping |
| `src/app/api/cron/` | 4 cron routes — all POST, all use `verifyCronSecret()` |
| `src/app/api/upload/route.ts` | Image upload — magic-byte MIME validation |
| `firestore.rules` | Security rules — all writes blocked from client |
| `firestore.indexes.json` | Composite indexes |
| `apphosting.yaml` | Firebase App Hosting config (Cloud Run settings + secrets) |

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
  // 1. Auth gate
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  // 2. Validate input at trust boundary
  const parsed = mySchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  try {
    // 3. Business logic (use transaction if modifying multiple docs)
    await db.runTransaction(async (tx) => {
      // ...
    });

    revalidatePath('/relevant-path');
    return successResponse(null);
  } catch (error) {
    log.error('[Action] doSomething failed', error);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}
```

---

## Adding a New Admin Action

```typescript
'use server';
import { requireAdmin } from '@/lib/admin-guard';

export async function adminAction(id: string) {
  await requireAdmin(); // throws if not admin — that's intentional
  // ...
}
```

---

## Adding a New Cron Route

```typescript
// src/app/api/cron/my-job/route.ts
import { verifyCronSecret, withRetry, cronSuccess, cronError } from '@/lib/cron-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    // job logic
    return { processed: 0 };
  }, { maxAttempts: 3 });

  if (result.error) return cronError(`my-job failed: ${result.error.message}`);
  return cronSuccess(result.data!);
}
```

Then register in `scripts/setup-cloud-scheduler.sh` as a POST request.

---

## Firestore Collections Reference

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | User profiles | `isPhoneVerified`, `isBanned`, `reputationScore`, `isVerifiedSeller` |
| `auctions` | Listings | `status`, `currentPrice`, `currentBidderId`, `endTime`, `sellerId` |
| `bids` | Bid history | `auctionId`, `bidderId`, `amount`, `createdAt` |
| `escrowTransactions` | Escrow lifecycle | `status`, `buyerId`, `auctionId`, `amount` |
| `conversations` | Chat threads | `buyerId`, `sellerId`, `auctionId` |
| `messages` | Chat messages | `conversationId`, `senderId`, `content` |
| `disputes` | Open disputes | `transactionId`, `openerId`, `status`, `reason` |
| `alerts` | Price alerts | `userId`, `auctionId`, `type`, `isActive`, `thresholdPrice` |
| `phoneVerifications` | OTP storage | `phone`, `otp` (SHA-256 hash), `expiresAt`, `verified` |
| `verificationTokens` | Email OTP | `identifier`, `token` (plaintext), `expires` |
| `admin_logs` | Admin audit trail | `adminId`, `action`, `targetId` |
| `cronFailures` | Cron error log | `job`, `auctionId`, `error`, `attempts` |
| `outbox_events` | (unused) | Remove if found — dead code |

---

## RTDB Paths Reference

```
bids/auction/{auctionId}          latest bid state (overwrite)
activity/auction/{auctionId}      bid activity feed (append)
activity/global                   homepage ticker (append)
notifications/user/{userId}       per-user notification inbox (append)
chat/conversation/{conversationId} chat messages (append)
presence/auction/{auctionId}/{userId} viewer presence (set/remove)
```

---

## Environment Validation

`src/lib/env.ts` validates all env vars on startup via Zod. During build phase, it soft-fails (Firebase App Hosting injects secrets at runtime, not build time). At runtime, a missing required var throws immediately.

Never access `process.env` directly in server code — use the `env` proxy from `src/lib/env.ts` which gives typed, validated values.

---

## Testing

```bash
npx vitest run                    # unit tests (src/lib/*, src/services/*)
npx playwright test               # e2e tests (tests/e2e/)
```

Unit tests live in `tests/unit/`. E2E tests in `tests/e2e/`.

When writing tests for actions, mock `auth()` and `db` — don't hit real Firestore.

---

## Common Gotchas

- **Firestore Timestamps:** Always use `toDate()` or the `toDate()` ternary pattern — raw Timestamps are not serializable to JSON and will crash RSC serialization.
- **`db.getAll()`:** Use this for batch reads instead of per-document `.get()` in loops.
- **Cron routes are POST, not GET.** HTTP GET must be idempotent — crons mutate state.
- **`EMAIL_REGEX` in pii-filter:** The `g` flag makes it stateful. Use `EMAIL_REGEX_TEST` (no flag) for `.test()` checks.
- **`placeBidSchema` validation:** The `placeBid` action does NOT currently run `placeBidSchema.safeParse()` before calling `BiddingService`. Add it if you change the action signature.
- **Phone-only users have `email: null`** — not a placeholder email. Handle nullable emails throughout.
- **Verification token doc IDs** are SHA-256 hashes, not the raw `identifier:token` — the `useVerificationToken` adapter handles this automatically.
