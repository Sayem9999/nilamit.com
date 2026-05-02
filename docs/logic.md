# Nilamit Business Logic: The Firebase-Native Engine

> Last Updated: May 2, 2026

## 1. Atomic Bidding & Proxy Logic
The bidding engine is encapsulated within `BiddingService.placeBid` using **Firestore Transactions**.

### Proxy Bidding (Auto-Max)
- **Mechanism**: Users can set a "Maximum Bid." The system automatically places the lowest possible bid required to remain the high bidder, up to the user's maximum.
- **Conflict Resolution**: If two users have proxy bids, the system increments the price until one maximum is reached. If maximums are identical, the earlier bidder retains priority.
- **Increment Logic**: Bids are incremented by ৳10 (minimum) or 1% of current price, whichever is higher.

### Anti-Sniping (Soft Close)
- **Trigger Window**: 2 minutes.
- **Extension**: If a bid is placed within this window, `endTime` is extended by 2 minutes.
- **Hard Limit**: Currently limited to one extension per auction to ensure predictability.

---

## 2. Commission & Financial Logic
Nilamit uses a **Tiered Commission Model** calculated at the moment of auction closure.

### Fee Structure
- **Tier 1 (≤ ৳10,000)**: 2.5% + ৳20 base fee.
- **Tier 2 (৳10,001 – ৳150,000)**: 1.5% + ৳20 base fee.
- **Tier 3 (> ৳150,000)**: 1.0% + ৳20 base fee.

### Top Rated Discount
- **Benefit**: Sellers with **Top Rated Plus** status (Gold Shield) receive a 10% discount on final success fees.
- **Calculation**: `finalFee = calculatedFee * 0.90`.

---

## 3. Account Tiering & Trust
### Bifurcated Registration
- **Personal Accounts**: Optimized for casual buyers and one-off sellers.
- **Business Accounts (Retailers)**: Unlocks professional tools (Bulk Upload, Analytics) and the **Indigo** UI theme. Required for storefront branding.

### Trust Metrics (eBay Style)
- **Top Rated Status**: Requirements = 10+ completed sales AND ≤ 5% defect rate (cancellations/disputes).
- **Verified Seller**: Requires manual NID/Business license verification by administrators.

---

## 4. Real-time Synchronization
### Event Broadcasting (RTDB)
Firestore serves as the "Source of Truth," while the **Firebase Realtime Database (RTDB)** serves as the high-frequency event bus:
- **Live Bids**: Successful transactions broadcast price updates to the auction's RTDB path.
- **Second Chance Offers**: Real-time notification to underbidders when a seller offers the item after the primary sale fails.

---

## 5. Security & Sanitization Pipeline
### The Defensive Chain
1. **Rate Limiting**: Request throttled via Upstash Redis.
2. **Authentication**: Identity verified via NextAuth.js.
3. **Authorization**: Ban and permission status checked against Firestore.
4. **XSS Sanitization**: User input cleaned using DOMPurify.
5. **PII Filtering**: Phone numbers and sensitive data masked automatically in public contexts.
