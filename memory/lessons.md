# 💡 Lessons: Patterns & Anti-Patterns

## Patterns to Follow
- **Transactional Bidding**: Always use `SELECT FOR UPDATE` to prevent race conditions.
- **Bengali UI Localization**: Use the `.bn` CSS class for high-contrast Bengali text.

## Lessons Learned (Anti-Patterns)
- **SVG Race Conditions**: 
    - *Issue*: Attaching D3 zoom hooks to an SVG before it is fully initialized leads to `ReferenceError`.
    - *Fix*: Ensure SVG selection and basic DOM structure are established before calling `.call(d3.zoom())`.
- **Next.js 15 Polling vs WebSockets**:
    - *Lesson*: High-frequency polling (5s) is acceptable for MVP but causes performance degradation during peak auctions. WebSockets (Firebase RTDB) is the preferred production path.
- **Phone Verification latency**:
    - *Lesson*: Do not gate browsing behind phone verification; only gate bidding/posting to reduce friction.
- **Micro-Deposit Advance vs. Full Price**:
    - *Insight*: Full-price escrow creates buyer drop-off in the Bangladesh COD market.
    - *Solution*: Use a "Small Advance" (Success Fee + Delivery Charge) to unlock contact info, leaving the balance for COD settlement.
- **Seller COD Liability**:
    - *Insight*: Sellers lose money on delivery fees when buyers flake.
    - *Solution*: Use the platform-held Advance to reimburse the seller's courier fee in case of buyer-side cancellation.

