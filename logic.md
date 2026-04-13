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
- **Logic**: If a bid is placed within the last 2 minutes of an auction, the `endTime` is automatically extended by another 2 minutes. 
- **Limit**: To prevent indefinite bidding loops, this extension happens **exactly once per auction**.

## 2. Trust & Reputation System
### Tiered Gated Identity
Nilamit balances speed and safety through a 3-tier gating hierarchy:
1. **Level 0 (Visitor)**: Authentication is **not required** for exploring the platform or viewing listings.
2. **Level 1 (Member)**: Requires authentication (Email, Google, or Phone) **PLUS mandatory Phone Verification (OTP)**. Allows **Bidding and Listing** on standard auctions.
3. **Level 2 (Trusted)**: Requires **MFS Linkage (bKash/Nagad)**. Mandatory for high-stakes coordination: Paying Escrow Advances or bidding on "Elite" items (৳100,000+).

### Win-First Privacy
- **Contact Release**: A seller's phone number and contact details are **NEVER** released to a potential buyer during the active auction phase, regardless of the seller's verified status.
- **Unlock**: Contact information is only visible to the **Winning Bidder** after the auction has successfully closed as SOLD.

## 3. Financial & Coordination Logic
### Coordination Engine (COD Optimized)
Nilamit provides the **Trust Layer** for Bangladesh's Cash on Delivery (COD) economy:
1. **MFS Linkage**: To participate in escrow (paying the Advance), users must link a verified **bKash** or **Nagad** account.
2. **The Hold**: The platform holds an **Advance** (Success Fee + Delivery Fee) for unverified sellers via linked MFS.
2. **The Coordination**: Once the advance is held, a private channel is opened for the buyer and seller to coordinate their own delivery (RedX, Pathao, or manual handoff).
3. **The Finalization**: "Release Escrow" indicates that the COD transaction was successful, triggering reputation gains and finalizing the platform fee.

## 4. Real-time Synchronization & Alerts
- **Bidding**: Pusher presence channels broadcast live bids to all viewers.
- **Proactive Alerts**: 
    - **Target Reach**: One-time trigger for user-set price goals. Mark `isActive: false` after firing.
    - **Outbid Follow**: Repeated triggers for users tracking auction heat without an active bid.
