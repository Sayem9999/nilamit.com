# Nilamit API Reference

> Last Updated: April 29, 2026

Nilamit uses Next.js **Server Actions** as the primary interaction layer, **REST API routes** for cron jobs and file uploads, and **Firebase RTDB** for real-time events.

All Server Actions return `ServiceResponse<T>` — `{ success: true, data: T }` or `{ success: false, error: { type, message, code?, details? } }`.

---

## Server Actions

### `src/actions/auction.ts`

| Action | Auth | Description |
|---|---|---|
| `getAuctions(filters)` | None | Query auctions with filters (category, status, price range, pagination) |
| `getAuction(id)` | None | Single auction with seller data |
| `createAuction(input)` | Phone-verified | Create listing — validates via `createAuctionSchema` |
| `getSpecializedFeeds()` | None | Homepage feeds: ending-soon auctions + live bid ticker (ACTIVE only) |

### `src/actions/bid.ts`

| Action | Auth | Description |
|---|---|---|
| `placeBid(auctionId, amount)` | Phone-verified, not banned, not minor | Atomic bid via Firestore transaction. Anti-snipe, outbid notification, RTDB broadcast. Rate-limited (60 bids/60s per user+IP). Elite deposit required for bids ≥ ৳100,000 by unverified sellers |
| `executeBuyItNow(auctionId)` | Phone-verified, not banned, not minor | Instant purchase at BIN price. Runs `processAuctionSale()` atomically |
| `getAuctionBids(auctionId)` | None | Bid history (last 50), hydrated with bidder name/avatar |

### `src/actions/auth.ts`

| Action | Auth | Description |
|---|---|---|
| `registerUser(data)` | None | Email/password registration. Rate-limited per IP (20/5min) |
| `signupWithPhone(data)` | None | Phone + OTP + password signup. Verifies OTP, checks phone uniqueness |
| `resetPasswordWithOTP(data)` | None | Reset password via phone OTP or email OTP |

### `src/actions/escrow.ts`

| Action | Auth | Description |
|---|---|---|
| `payEscrowAdvance(txId, providerRef?)` | Buyer | PENDING → HELD. Requires MFS linkage (bKash/Nagad). Creates conversation. |
| `confirmItemReceived(txId)` | Buyer | HELD → RELEASED. Triggers reputation recalculation. |
| `markAsShipped(txId, trackingNumber)` | Seller | Sets auction `deliveryStatus: SHIPPED`. Atomic ownership check. |
| `refundEscrow(txId)` | Admin only | HELD/DISPUTED → REFUNDED. Cancels auction. |

### `src/actions/dispute.ts`

| Action | Auth | Description |
|---|---|---|
| `raiseDispute(txId, reason)` | Buyer | HELD → DISPUTED. Creates dispute doc. |
| `resolveDispute(disputeId, ruling, resolution)` | Admin | Closes dispute — SELLER ruling releases funds, BUYER ruling refunds |
| `adminRefundEscrow(txId, reason)` | Admin | Direct refund with reason logging |
| `getOpenDisputes()` | Admin | All open disputes, fully hydrated in 3 batch passes |

### `src/actions/admin.ts`

| Action | Auth | Description |
|---|---|---|
| `getAdminStats()` | Admin | Platform counts (users, auctions, bids, revenue) via Firestore aggregations |
| `adminToggleVerification(userId)` | Admin | Toggle `isVerifiedSeller`. Writes audit log. |
| `getAdminDisputes()` | Admin | DISPUTED escrows with dispute reasons — batched hydration |
| `resolveAdminDispute(txId, resolution)` | Admin | RELEASE or REFUND with audit trail |
| `getAdminCoordinationLog(auctionId)` | Admin | Buyer/seller chat history |
| `getTreasuryAudit()` | Admin | HELD/RELEASED escrows — batched hydration |
| `getAdminActiveEscrows()` | Admin | All HELD escrows — batched hydration |

### `src/actions/phone.ts`

| Action | Auth | Description |
|---|---|---|
| `sendPhoneOTP(phone)` | Session required | Send OTP to phone for verification. Rate-limited (5/hour per phone number) |
| `verifyPhoneOTP(phone, otp)` | Session required | Verify OTP, mark user `isPhoneVerified: true` |
| `requestStandaloneOTP(phone)` | None | Send OTP without session (for signup flow) |
| `sendEmailOTP(email)` | None | Send OTP to email for password reset. Rate-limited (5/hour) |

### `src/actions/chat.ts`

| Action | Auth | Description |
|---|---|---|
| `sendMessage(input)` | Buyer or seller | Send chat message. PII-filtered, requires active escrow. Image support. |
| `getConversation(auctionId)` | Participant | Fetch conversation with message history |
| `getConversations()` | Session | List all user's active conversations |

### `src/actions/alerts.ts`

| Action | Auth | Description |
|---|---|---|
| `createAlert(data)` | Session | Create OUTBID, TARGET_REACHED, or ENDING_SOON alert |
| `deleteAlert(alertId)` | Owner | Remove alert |
| `getUserAlerts()` | Session | List active alerts for current user |

### `src/actions/watchlist.ts`

| Action | Auth | Description |
|---|---|---|
| `addToWatchlist(auctionId)` | Session | Watch an auction |
| `removeFromWatchlist(auctionId)` | Session | Unwatch |
| `getWatchlist()` | Session | List watched auctions |

---

## REST API Routes

### `POST /api/upload`

Upload an image to Firebase Storage.

**Auth:** Session required  
**Rate limit:** 100 requests/60s per user  
**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | Image file (JPEG, PNG, WebP, GIF) |
| `type` | string | `auction` (4MB limit) or `chat` (2MB limit) |

MIME type is validated from magic bytes — the client-supplied Content-Type is not trusted.

**Response:** `{ url: string }`

Auction images are made public; chat images use a 7-day signed URL.

---

### `POST /api/cron/close-auctions`

Close all ACTIVE auctions whose `endTime <= now`.

**Auth:** `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret: <CRON_SECRET>`  
**Caller:** Cloud Scheduler (every minute)

Delegates to `closeAllEndedAuctions()`:
- No bids → `EXPIRED`
- Has bids + reserve met → `SOLD`, creates escrow `PENDING`, notifies winner

**Response:** `{ success, closedAt, attempts }`

---

### `POST /api/cron/process-auctions`

Identical to `close-auctions`. Exists for backwards compatibility with existing Cloud Scheduler jobs. Run only one of these two per scheduler.

---

### `POST /api/cron/closing-soon`

Send ending-soon notifications for auctions ending in < 2 hours that have active watchers.

**Auth:** CRON_SECRET  
**Caller:** Cloud Scheduler (every 15 minutes)

---

### `POST /api/cron/process-alerts`

Process pending price alerts — fire OUTBID and TARGET_REACHED notifications.

**Auth:** CRON_SECRET  
**Caller:** Cloud Scheduler (every 2 minutes)

---

### `GET /api/health`

Health check endpoint.

**Auth:** None  
**Response:**
```json
{
  "status": "ok",
  "db": "connected",
  "latencyMs": 12,
  "uptime": 3600,
  "timestamp": "2026-04-15T10:00:00.000Z"
}
```

---

### `POST /api/firebase/token`

Exchange a NextAuth session for a Firebase custom auth token (for client SDK RTDB access).

**Auth:** Session required  
**Response:** `{ token: string }`

---

### `POST /api/auth/[...nextauth]`

NextAuth handler. Handles sign-in, sign-out, OAuth callbacks.

---

### `GET /api/og`

Open Graph image generation for auction pages.

**Params:** `?auctionId=<id>` or `?title=<title>&price=<price>`

---

## Real-time Events (Firebase RTDB)

Clients subscribe using the Firebase client SDK (`onValue`, `onChildAdded`).

### Auction bid state — `bids/auction/{auctionId}`

Overwrites on every bid. Subscribe with `onValue`.

```json
{
  "event": "new_bid",
  "amount": 15000,
  "endTime": "2026-04-29T12:34:56.000Z",
  "bidderName": "Rahim",
  "_ts": 1714388096000
}
```

### Auction activity feed — `activity/auction/{auctionId}`

Append-only bid history. Subscribe with `onChildAdded`.

### User notifications — `notifications/user/{userId}`

Append-only inbox. Subscribe with `onChildAdded`.

| Event | Trigger | Payload |
|---|---|---|
| `auction_won` | Auction closes with this user as winner | `auctionId`, `title`, `amount` |
| `outbid_alert` | User outbid on an auction | `auctionId`, `auctionTitle`, `amount`, `newBidderName` |
| `price_alert` | TARGET_REACHED alert fires | `auctionId`, `amount`, `type`, `threshold` |
| `ending_soon` | Watched auction closing in < 2h | `auctionId`, `auctionTitle` |
| `advance_paid` | Buyer paid advance (seller notification) | `auctionId`, `auctionTitle`, `message` |
| `trust_update` | Sale confirmed, reputation updated | `message` |

### Global activity ticker — `activity/global`

Append-only feed for the homepage live ticker. Pruned to last 20 entries.

---

## Error Codes Reference

| Code | Meaning |
|---|---|
| `NOT_AUTHENTICATED` | No valid session |
| `PHONE_NOT_VERIFIED` | Action requires phone verification |
| `AUCTION_NOT_ACTIVE` | Auction is not in ACTIVE state |
| `AUCTION_ENDED` | Auction end time has passed |
| `BID_TOO_LOW` | Bid below minimum — details.newMinimum has the required amount |
| `SELF_BID_FORBIDDEN` | Cannot bid on own auction |
| `ELITE_DEPOSIT_REQUIRED` | High-value bid requires deposit on file |
| `NOT_FOUND` | Resource does not exist |

Error responses from all Server Actions follow this shape:
```typescript
{
  success: false,
  error: {
    type: ErrorType,      // VALIDATION_ERROR | UNAUTHORIZED_ERROR | etc.
    message: string,      // Human-readable
    code?: string,        // Machine-readable (ERROR_CODES constant)
    details?: unknown,    // Extra context (e.g. { newMinimum: 15000 })
  }
}
```
