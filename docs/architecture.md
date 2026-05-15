# Nilamit Architecture

> Last Updated: May 2, 2026

---

## System Overview

Nilamit is a Next.js 16 full-stack application using a **layered SOA pattern**: Server Actions as thin controllers, domain Services for business logic, and Firebase as the data layer. All client-to-database writes are forbidden — every mutation goes through Server Actions using the Firebase Admin SDK.

```
Browser (React 19)
  │
  ├── Client Components      → UI state, RTDB listeners, session reads
  │
  └── Server Actions         → Auth gate, Zod validation, **Bifurcation**, revalidation
       │                        src/actions/*.ts
        ├── Domain Services   → Business logic Layer
        │   src/services/     → BiddingService, AuctionService
        │    └── Modules      → Specialized Reader/Writer/Notifier sub-modules
        │
        └── Infrastructure    → src/lib/
             ├── Firestore    → All persistent state (Admin SDK only)
             ├── RTDB         → Real-time events (bids, notifications, presence)
             ├── Firebase Storage → Images, chat attachments
             ├── Upstash Redis   → High-throughput Rate limiting (sliding window)
             └── Sentry          → Error tracking + performance (Area/Severity tagged)
```

---

## Layer Responsibilities

### Layer 1 — Frontend (Next.js App Router)

- **Server Components** pre-fetch and render initial page state.
- **Client Components** manage interactive UI: bid panel, countdown timer, RTDB listeners.
- **Routing:** flat `src/app/` (no locale prefix). `next-intl` is wired as a message-loading layer for future expansion but only English (`messages/en.json`) ships today.
- **Bifurcated Registration:** The `/register` entry point implements a multi-step flow that branches into **Personal** or **Business** account paths, ensuring appropriate data capture and UI theming from the first touchpoint.

### Layer 2 — Server Actions (`src/actions/`)

Thin controllers acting as the API boundary. Each action:
1. Calls `auth()` or `requireAdmin()` to verify session/permissions.
2. Validates input through a Zod schema from `src/lib/schemas.ts`.
3. Delegates business logic to the appropriate Domain Service.
4. Calls `revalidatePath()` or `revalidateTag()` on success.
5. Returns a standardized `ServiceResponse<T>` — never throws to the client.

**Scalability Pattern:** Large action files are decomposed into domain-specific modules and unified via barrel exports.

### Layer 3 — Domain Services (`src/services/`)

Pure business logic, decoupled from the HTTP/Action layer. For high scalability, large services are decomposed into specialized sub-modules:

- **`BiddingService`** — Facade for the bidding domain.
  - `BidProcessor`: Atomic transactions, Proxy Bidding, Anti-sniping.
  - `BidSideEffects`: RTDB syncing, outbid notifications, seller alerts.
- **`AuctionService`** — Facade for the auction domain.
  - `AuctionReader`: Hydrated queries, PII-shielded data fetching.
  - `AuctionWriter`: Listing creation, cloud task scheduling, status updates.
  - `AuctionNotifier`: Fan-out notifications to followers and watchers.
- **`AdminService`** — Dashboard aggregations and manual escrow overrides.

---

## Layer 4 — Infrastructure (`src/lib/`)

| File | Responsibility |
|---|---|
| `auth.ts` | NextAuth config, FirestoreAdapter (JWT strategy), session synchronization for metrics |
| `admin-guard.ts` | Hardened `requireAdmin()` guard — verifies session against real-time DB state |
| `db.ts` | Firestore proxy singleton and document mapping utilities |
| `logger.ts` | Structured logging with Sentry integration and performance tracing |
| `ratelimit.ts` | Upstash-backed limiters — fail-closed in production |
| `auction-logic.ts` | Core sale processing: tiered commissions, escrow creation, and notifications |
| `schemas.ts` | Centralized Zod validation schemas for all platform entry points |
| `errors.ts` | Standardized `ServiceResponse<T>` and `AppError` architecture |
| `env.ts` | Robust environment validation and sanitization for production secrets |

---

## Data Architecture

### Firestore (Source of Truth)

All persistent state lives in Firestore. Key design decisions:

- **`currentPrice` and `currentBidderId` are denormalized onto the auction document.**
- **`escrowTransactions` doc ID = `auctionId`** for idempotent upsert.
- **Client writes are blocked.** `firestore.rules` forbids all client-side writes.

### Firebase Realtime Database (Event Bus)

RTDB is used for high-frequency, ephemeral state:

| Path | Data | Pattern |
|---|---|---|
| `bids/auction/{id}` | Latest bid price + bidder | Overwrite |
| `activity/auction/{id}` | Bid history feed | Append |
| `notifications/user/{id}` | Per-user inbox | Append |

---

## Security Architecture

### Defense in Depth

```
Request
  → Middleware (auth check, ban redirect, i18n routing)
  → Server Action (auth(), Zod validation, rate limit)
  → Service (business rule enforcement)
  → Firestore Security Rules (write: if false)
```

---

## Commission Model

| Sale price | Rate | Base fee |
|---|---|---|
| ≤ ৳10,000 | 2.5% | + ৳20 |
| ৳10,001 – ৳150,000 | 1.5% | + ৳20 |
| > ৳150,000 | 1.0% | + ৳20 |

---

## Performance Patterns

- **Batch reads over N+1:** Admin hydration uses `db.getAll()`.
- **Firestore aggregations:** Admin stats use `.count().get()`.
- **Request-Level Caching:** Critical server actions are wrapped in React `cache()`.
