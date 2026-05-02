# Nilamit Architecture

> Last Updated: April 30, 2026

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

Thin controllers acting as the API boundary. Each action:
1. Calls `auth()` or `requireAdmin()` to verify session/permissions.
2. Validates input through a Zod schema from `src/lib/schemas.ts`.
3. Delegates business logic to the appropriate Domain Service.
4. Calls `revalidatePath()` or `revalidateTag()` on success.
5. Returns a standardized `ServiceResponse<T>` — never throws to the client.

**Scalability Pattern:** Large action files (like `admin.ts`) are decomposed into domain-specific modules in sub-directories (e.g., `src/actions/admin/stats.ts`, `src/actions/admin/disputes.ts`) and unified via barrel exports.

### Layer 3 — Domain Services (`src/services/`)

Pure business logic, decoupled from the HTTP/Action layer:

- **`BiddingService`** — Handles atomic bid placement, anti-snipe extensions, and denomination logic.
- **`AdminService`** — Centralizes administrative logic: dashboard aggregations, manual escrow overrides, and user verification workflows.
- **`AuctionService`** — Manages complex listing queries, filtering, and PII-aware hydration.

Services are designed to be callable by Server Actions, Cron routes, and background workers alike.

### Layer 4 — Infrastructure (`src/lib/`)

| File | Responsibility |
|---|---|
| `auth.ts` | NextAuth config, FirestoreAdapter (JWT strategy), session synchronization |
| `admin-guard.ts` | Hardened `requireAdmin()` guard — verifies session against real-time DB state |
| `db.ts` | Firestore proxy singleton and document mapping utilities |
| `logger.ts` | Structured logging with Sentry integration and performance tracing |
| `ratelimit.ts` | Upstash-backed limiters — fail-closed in production |
| `auction-logic.ts` | Core sale processing: commissions, escrow creation, and notifications |
| `schemas.ts` | Centralized Zod validation schemas for all platform entry points |
| `errors.ts` | Standardized `ServiceResponse<T>` and `AppError` architecture |
| `env.ts` | Robust environment validation and sanitization for production secrets |

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
- **Request-Level Caching:** Critical server actions (e.g., `getAuction`, `getAuctions`) are wrapped in React `cache()` to eliminate redundant database waterfalls within a single request lifecycle.
- **Memoization:** High-frequency UI components (`AuctionCard`, `VerificationBadge`) are memoized via `React.memo` to optimize client-side rendering during search/filter operations.
- **Lazy Loading:** Heavy interactive components (modals, payment gateways) use `next/dynamic` to minimize the initial JS bundle size.
- **Denormalization:** Bid panel reads `currentPrice` and `currentBidderId` from the auction doc (already loaded), not from a separate bids query.
