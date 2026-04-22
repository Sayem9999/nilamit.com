# Nilamit Business Logic: The Firebase-Native Engine

## 1. Atomic Bidding Logic
The bidding engine is encapsulated within `BiddingService.placeBid` using **Firestore Transactions**.

### Race-Condition & Integrity
To handle high-concurrency bidding:
- **Transaction Wrap**: The entire bidding process (Price check → Previous bidder lookup → Bid creation → Price update → Extension logic) is wrapped in a single Firestore Transaction.
- **Optimistic Locking**: Firestore ensures that if the auction document is modified by another user during processing, the transaction automatically retries to maintain consistency.
- **Validation**: We verify `auction.status == 'ACTIVE'`, `now < auction.endTime`, and `amount >= minRequired` inside the atomic block.

### Anti-Sniping (Soft Close)
- **Trigger Window**: 2 minutes (SOFT_CLOSE_WINDOW_MS).
- **Extension**: If a bid is placed within this window, `endTime` is extended by 2 minutes (SOFT_CLOSE_EXTENSION_MS).
- **Hard Limit**: This extension currently happens **exactly once** per auction to prevent infinite bidding loops.

---

## 2. Secure Identity & Moderation
### Multi-Stage Verification Gating
Nilamit uses a 4-tier verification system enforced at both the UI (VerificationGuard) and Action (Server Guard) layers:
1. **Level 0 (Guest)**: Read-only access to public auctions.
2. **Level 1 (Authenticated)**: User can edit profile and watchlist.
3. **Level 2 (Phone Verified)**: The **Active Gate**. Required for placing bids and creating auctions. Enforced via OTP.
4. **Level 3 (Trusted)**: Requires MFS linkage (bKash/Nagad). Required for high-value "Elite" auctions (৳100,000+).

### Ban Enforcement
- **Middleware Lock**: Banned users are instantly redirected away from protected paths.
- **Action Lockdown**: Every critical Server Action (`placeBid`, `createAuction`, `updateProfile`) performs a fresh database check for `isBanned` status before execution, closing the gap for stale session tokens.

---

## 3. High-Performance Data Fetching
### Parallelized List Engine
To ensure sub-100ms LCP on listing pages:
- **Parallel Fetching**: We fetch the "Total Count" and the "Paginated Data" in parallel using `Promise.all`.
- **Batch Identity Lookup**: To resolve the N+1 problem (showing seller/bidder info), we extract unique IDs from the result set and perform a single batch lookup for user metadata.

---

## 4. Real-time Synchronization
### Event Broadcasting (RTDB)
Firestore serves as the "Source of Truth," while the **Firebase Realtime Database (RTDB)** serves as the high-frequency event bus:
- **Live Bids**: Every successful bid transaction broadcasts the new price and bidder info to the auction's RTDB path.
- **Presence**: Tracks active viewers via RTDB's dedicated presence listeners.
- **In-App Alerts**: Private notification channels for outbid alerts and price-reaches.

---

## 5. Security & Sanitization Pipeline
### The Defensive Chain
1. **Rate Limiting**: Request throttled at the network edge via Upstash Redis.
2. **Authentication**: Identity verified via NextAuth.js.
3. **Authorization**: Ban and permission status checked against Firestore.
4. **XSS Sanitization**: User input recursively cleaned using DOMPurify (`src/lib/sanitizer.ts`).
5. **PII Filtering**: Sensitive information (phone numbers, addresses) masked using regex patterns.
6. **Persistence**: Clean, safe data written to the database.
