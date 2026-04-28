# 💎 Nilamit Spec-Kit (v1.0)

This document is the **Single Source of Truth** for the Nilamit architectural standards and feature specifications. Every new feature must be spec'd here or in a feature-specific spec file before implementation.

---

## 1. Architectural Standards

### 1.1 Data Integrity & Concurrency
- **Transaction Isolation**: All critical state changes (Bidding, Settlement) must use `Serializable` isolation level.
- **Row-Level Locking**: High-concurrency models (Auctions) must use `SELECT ... FOR UPDATE` via `tx.$queryRaw` to prevent race conditions during heavy traffic.
- **Firestore Proxy**: Access the database via the type-safe proxy in `src/lib/db.ts`. This ensures compatibility with the Edge runtime without bundling the heavy Node.js Firestore engine.

### 1.2 Real-time Infrastructure (Firebase RTDB)
| Channel | Type | Usage |
|---|---|---|
| `user-{userId}` | Private | Personal alerts (Outbid, Ending Soon). |
| `presence-auction-{id}` | Presence | Live auction room (New bids, User list). |
| `global-ticker` | Public | Homepage live activity stream. |

### 1.3 Tech Stack
- **Framework**: Next.js 16 (App Router + Turbopack).
- **ORM**: Firestore 7 (NoSQL).
- **Styling**: Tailwind CSS 4 + Framer Motion 12.
- **Auth**: NextAuth v5 (Beta).

---

## 2. Domain Specifications

### 2.1 Auction Logic (The "Core")
- **Anti-Snipe (Soft Close)**: 
    - **Trigger**: If a bid is received within the `SOFT_CLOSE_WINDOW` (default: 2 mins) of expiration.
    - **Effect**: Extend `endTime` by `SOFT_CLOSE_EXTENSION` (default: 2 mins).
- **Minimum Increment**: Bids must be exactly `currentPrice + minBidIncrement`.
- **Bid Deposits**: Bids over ৳10,000 require a `held` deposit unless the user is a `Verified Seller`.

### 2.2 User Progression & Trust
- **Verified Seller**: Manual admin toggle. Grants the blue shield badge and bypasses standard bid deposits.
- **User Levels**: Calculated based on transaction volume and successful wins.
- **Winning Streaks**: Triggered by $\ge 3$ wins in a 7-day period.

---

## 3. UI/UX Design System

### 3.1 Visual Guidelines
- **Theme**: Premium Dark/Light mode with high-contrast semantics.
- **Aesthetics**: Glassmorphism (blur backgrounds), subtle card shadows, and HSL-based harmonious colors.
- **Micro-interactions**: Hover scales (102%), layout transitions (Framer Motion), and haptic-like visual feedback on success.

### 3.2 Performance
- **Zero Placeholders**: Use generated visual assets or optimized CDN-hosted content.
- **Rendering**: Static exports where possible, dynamic for real-time components.

---

## 4. API & Development Patterns

### 4.1 Server Actions
All interactive actions should return a standard result object:
```typescript
type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string; // Standardized error codes (lib/constants.ts)
}
```

### 4.2 Error Handling
- **Database Unavailable**: Graceful fallback to cached data or fallback UI fragments (Pattern: `isDatabaseUnavailable`).
- **Authorization**: Compulsory `requireAdmin()` check for management actions.

---

## 7. Verification Protocol
- **Build**: `npm run build` must pass with zero TypeScript errors.
- **Real-time**: Manual verification of Firebase RTDB event chains using local Firebase RTDB Debug Console.
- **State**: Verification of DB state shifts using Firestore Studio after critical transactions.

---

## 5. Compliance & Legal Standards
- **Governance**: All features must adhere to the **[legalframework.md](file:///c:/nilamit.com/legalframework.md)**.
- **Data Retention**: All transaction and communication logs must be retained for **6 years**, ensuring auditability under Bangladesh Digital Commerce Guidelines 2021.
- **Redressal**: The Admin Panel must support a **72-hour SLA** for formal complaint resolution.
- **Escrow Integrity**: The `EscrowTransaction` state machine must strictly follow the PENDING -> HELD -> RELEASED flow to protect user capital.

## 6. Regional & Social Filtering (Circles)

### 6.1 Area Logic (Geographic)
- **Precision**: Locations are stored as normalized strings (e.g., mirpur, banani, dhanmondi) and indexed for high-performance retrieval.
- **Search**: The `getAuctions` engine must prioritize items in the user's "Home Area" (stored in `UserProfile`) to minimize logistics friction.
- **UI**: Property cards must prominently display the area tag with a location icon.

### 6.2 Circle Logic (Social)
- **Visibility**: Auctions created with a `circleId` are **invisible** to any user who is not a verified member of that specific `AuctionCircle`.
- **Integrity**: The `placeBid` action must perform an membership check (`CircleMember`) if the auction belongs to a circle.
- **Growth**: Circle owners manage membership via unique `inviteCode`s. The invite system must support "One-time" or "Timed" codes in future phases.
- **Trust Factor**: Bids made within circles are flagged with a "Circle Member" badge to signal social accountability to the seller.
