# Nilamit Architecture

> Last Updated: April 29, 2026

---

## System Overview

Nilamit is a Next.js 16 full-stack application using a **layered SOA pattern**: Server Actions as thin controllers, domain Services for business logic, and Firebase as the data layer. All client-to-database writes are forbidden — every mutation goes through Server Actions using the Firebase Admin SDK.

```
Browser (React 19)
  │
  ├── Client Components      → UI state, RTDB listeners, session reads
  │
  └── Server Actions         → Auth gate, Zod validation, revalidation
       │                        src/actions/*.ts
       ├── Domain Services   → Business logic, Firestore transactions
       │   src/services/     → BiddingService, AuctionService
       │
       └── Infrastructure    → src/lib/
            ├── Firestore    → All persistent state (Admin SDK only)
            ├── RTDB         → Real-time events (bids, notifications, presence)
            ├── Firebase Storage → Images, chat attachments
            ├── Upstash Redis   → Rate limiting (fail-closed in production)
            └── Sentry          → Error tracking + performance
```

---

## Layer Responsibilities

### Layer 1 — Frontend (Next.js App Router)

- **Server Components** pre-fetch and render initial page state.
- **Client Components** manage interactive UI: bid panel, countdown timer, RTDB listeners.
- **Routing:** `src/app/[locale]/` provides English/Bengali i18n via `next-intl`. All UI routes are locale-prefixed.
- **Real-time:** Clients subscribe to Firebase RTDB paths for live bid prices, viewer counts, and notifications. RTDB is append-only from the server — clients only read.

### Layer 2 — Server Actions (`src/actions/`)

Thin controllers. Each action:
1. Calls `auth()` to verify session
2. Validates input through a Zod schema from `src/lib/schemas.ts`
3. Calls the appropriate Service or library function
4. Calls `revalidatePath()` on success
5. Returns a typed `ServiceResponse<T>` — never throws to the client

Actions never contain business logic. They are the authentication and validation boundary.

### Layer 3 — Domain Services (`src/services/`)

Stateless business logic, decoupled from the HTTP layer:

- **`BiddingService`** — `placeBid()` runs a serializable Firestore transaction. All bid validation, anti-snipe extension, and denormalization of `currentPrice`/`currentBidderId` onto the auction document happen here atomically.
- **`AuctionService`** — listing queries with cursor pagination, single-auction fetch with seller hydration.

Services are also called directly by cron routes.

### Layer 4 — Infrastructure (`src/lib/`)

| File | Responsibility |
|---|---|
| `auth.ts` | NextAuth config, inline FirestoreAdapter (JWT strategy), session/JWT callbacks |
| `auth.config.ts` | Edge-safe NextAuth subset used in middleware |
| `admin-guard.ts` | Single `requireAdmin()` guard — all admin actions import from here |
| `db.ts` | Firestore proxy singleton, `docData()`, `snapDocs()`, `newId()`, `toSellerPublic()` |
| `firebase-admin.ts` | Admin SDK init (throws on missing secrets), `rtdbPush()`, `rtdbSet()` |
| `firebase-client.ts` | Browser SDK for Auth, Storage, Analytics |
| `ratelimit.ts` | Upstash-backed limiters — fail-closed in production |
| `auction-logic.ts` | `processAuctionSale()` — reserve check, commission calc, escrow creation, winner notification |
| `schemas.ts` | All Zod schemas for trust-boundary inputs |
| `sanitizer.ts` | HTML/XSS stripping via DOMPurify |
| `pii-filter.ts` | Phone/email/bypass-keyword redaction in public text |
| `errors.ts` | `ServiceResponse<T>`, `errorResponse()`, `successResponse()`, `ErrorType` enum |
| `env.ts` | Zod env validation — soft-fails during build, throws at runtime |
| `cron-utils.ts` | `verifyCronSecret()`, `withRetry()`, `cronSuccess()`, `cronError()` |

---

## Data Architecture

### Firestore (Source of Truth)

All persistent state lives in Firestore. Key design decisions:

- **`currentPrice` and `currentBidderId` are denormalized onto the auction document.** The bidding transaction reads and locks these from the auction doc itself, not from a separate query on the bids collection. This is critical — collection queries inside a Firestore transaction are not transactionally locked.
- **`escrowTransactions` doc ID = `auctionId`** for idempotent upsert via `{ merge: true }`.
- **`conversations` doc ID = `auctionId`** by convention, linking chat to its auction.
- **Client writes are blocked.** `firestore.rules` forbids all client-side writes to every collection. Reads are scoped per collection (public, authenticated, admin-only).

### Firebase Realtime Database (Event Bus)

RTDB is used for high-frequency, ephemeral state that Firestore's cost model doesn't suit:

| Path | Data | Pattern |
|---|---|---|
| `bids/auction/{id}` | Latest bid price + bidder | Overwrite (`rtdbSet`) |
| `activity/auction/{id}` | Bid history feed | Append (`rtdbPush`) |
| `activity/global` | Homepage ticker | Append |
| `notifications/user/{id}` | Per-user inbox | Append |
| `chat/conversation/{id}` | Messages | Append |
| `presence/auction/{id}/{userId}` | Viewer presence | Set/remove |

RTDB data is append-only from the server side. The client SDK reads with `onValue` or `onChildAdded` listeners.

---

## Security Architecture

### Defense in Depth

```
Request
  → Middleware (auth check, ban redirect, i18n routing)
  → Server Action (auth(), Zod validation, rate limit)
  → Service (business rule enforcement)
  → Firestore Security Rules (write: if false for all collections)
```

### Key Security Properties

- **Admin gate:** `requireAdmin()` checks `ADMIN_EMAILS` env var (normalized to lowercase). Admin status is also derived from this env var in the JWT callback — never from user-supplied data.
- **Rate limiting:** Fail-closed in production. If Upstash is unreachable, requests are rejected with 429. `bidLimiter`, `authLimiter`, `loginLimiter`, `phoneOtpSendLimiter`, `phoneOtpVerifyLimiter` each have independent windows.
- **OTP security:** Generated with `crypto.randomInt()` (CSPRNG), stored as SHA-256 hash, consumed and deleted on first use.
- **JWT refresh:** Token re-reads Firestore every 5 minutes, ensuring ban/verification changes propagate quickly.
- **CSP:** `script-src` allows `'unsafe-inline'` (required for Next.js hydration scripts) but not `'unsafe-eval'`. Full header set in `next.config.ts`.

### Firestore Rules Summary

| Collection | Read | Write |
|---|---|---|
| `users` | Self or admin | Blocked (Admin SDK only) |
| `auctions` | Public | Blocked |
| `bids` | Public | Blocked |
| `conversations` | Participants or admin | Blocked |
| `messages` | Participants or admin | Blocked |
| `escrowTransactions` | — | Blocked |
| `reports` | Admin only | Blocked |
| Everything else | Blocked | Blocked |

---

## Cron Architecture

Four scheduled jobs run on Cloud Scheduler, all hitting `POST` endpoints:

| Job | Endpoint | Schedule | What it does |
|---|---|---|---|
| close-auctions | `POST /api/cron/close-auctions` | Every minute | Closes expired ACTIVE auctions via `closeAllEndedAuctions()` |
| process-auctions | `POST /api/cron/process-auctions` | Every minute | Alias for close-auctions (backwards compat — run only one) |
| closing-soon | `POST /api/cron/closing-soon` | Every 15 min | Sends ending-soon notifications for watched auctions |
| process-alerts | `POST /api/cron/process-alerts` | Every 2 min | Processes pending price alerts |

All cron routes verify `CRON_SECRET` via `Authorization: Bearer <secret>` or `X-Cron-Secret` header. In production without a secret configured, all cron requests are rejected with 500. Failed jobs are recorded in the `cronFailures` Firestore collection for operator review.

---

## Commission Model

| Sale price | Rate | Base fee |
|---|---|---|
| ≤ ৳10,000 | 2.5% | + ৳20 |
| ৳10,001 – ৳150,000 | 1.5% | + ৳20 |
| > ৳150,000 | 1.0% | + ৳20 |

For **verified sellers**: escrow holds `finalPrice` (full amount).
For **unverified sellers**: escrow holds `commission + deliveryCharge` only.

Delivery charge defaults to ৳0 unless set on the auction.

---

## Performance Patterns

- **Batch reads over N+1:** All admin hydration (disputes, treasury, active escrows) uses `db.getAll(...refs)` in 3 round-trips regardless of row count.
- **Parallel fetches:** Unrelated reads use `Promise.all()`.
- **Firestore aggregations:** Admin stats use `.count().get()` — counts 1000 docs for the cost of 1 read.
- **Denormalization:** Bid panel reads `currentPrice` and `currentBidderId` from the auction doc (already loaded), not from a separate bids query.
- **Live ticker filtering:** Homepage bid feed fetches 25 bids, filters to ACTIVE-auction bids only, returns 10.
