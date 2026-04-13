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

## 3. Financial & Commission Logic
### Success Fee Tiers (v1.5)
To maintain a "Free to List" model, Nilamit automatically calculates a platform fee upon successful closure:
- **Silver Tier** (<= ৳10,000): 2.5% + ৳20 flat fee.
- **Gold Tier** (৳10,001 - ৳150,000): 1.5% + ৳20 flat fee.
- **Platinum Tier** (> ৳150,000): 1% + ৳20 flat fee.

### Escrow Shield Workflow
Funds are managed based on the seller's trust level:
1. **Verified Sellers**: Advance payment is NOT required from the buyer for logistics coordination. The full payment is expected upon completion.
2. **Standard Sellers**: Coordination chat is gated. The buyer must pay an **Advance** (Commission + Delivery Fee) which is held by the platform. Once held, coordination is unlocked.

## 4. Real-time Synchronization & Alerts
- **Bidding**: Pusher presence channels broadcast live bids to all viewers.
- **Proactive Alerts**: 
    - **Target Reach**: One-time trigger for user-set price goals. Mark `isActive: false` after firing.
    - **Outbid Follow**: Repeated triggers for users tracking auction heat without an active bid.
