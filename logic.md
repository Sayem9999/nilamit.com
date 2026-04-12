# ⚙️ Nilamit Business Logic

## 1. Atomic Bidding Engine
The heart of Nilamit is the atomic bidding engine in `src/actions/bid.ts`.

### Race-Condition Prevention
To handle 100+ users bidding at the exact same millisecond:
- **Locking**: We use a `FOR UPDATE` raw query within a Prisma transaction. This locks the specific auction row at the database level.
- **Isolation**: The transaction isolation level is set to `Serializable` to ensure maximum consistency.
- **Validation**: We re-verify `currentPrice` and `status` *after* the lock is acquired but before the new bid is written.

### Anti-Sniping (Soft Close)
- **Window**: 2 minutes.
- **Logic**: If a bid is placed within the last 2 minutes of an auction, the `endTime` is automatically extended by another 2 minutes. This prevents "sniping" bots from stealing items at the last second and encourages healthy price discovery.

## 2. Trust & Reputation System
### Phone-First Identity
- **Anchor**: Mobile numbers (+880) are the primary trust anchor.
- **Verification**: OTP-based verification is required before any bidding or listing activity.

### Reputation Scores
- **Calculation**: Derived from successful payments, positive reviews, and auction participation frequency.
- **Impact**: High reputation users may bypass bid deposit requirements.

## 3. Financial Logic
### Bid Deposits (Phase 2)
- **Threshold**: Auctions over ৳10,000 require a pre-authorized deposit.
- **Holding**: Deposits are "held" until the auction is won by someone else or the user wins and completes payment.

### Escrow Sandbox
- **Workflow**: Payment is held in a virtual escrow after an auction ends.
- **Release**: Funds are released to the seller only after the buyer confirms receipt or a dispute resolution window expires.

## 4. Real-time Synchronization
- **Pusher**: Used for live price updates and outbid notifications.
- **Presence**: Tracks how many active bidders are currently viewing an auction page.
