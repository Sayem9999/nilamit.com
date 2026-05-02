---
title: "Product Manager Guide"
description: "Feature capabilities, user journeys, and platform limitations"
---

# Product Manager Guide

This guide covers the functional capabilities of Nilamit, typical user journeys, and current platform constraints to help product teams plan and prioritize features.

## User Journeys

### 1. The Trust-Focused Seller
1. **Verification**: Seller verifies phone number and identity.
2. **Listing**: Seller creates an auction with a starting price and optional "Buy It Now" price.
3. **Escrow**: Seller receives an "Escrow Funded" notification once a winner pays.
4. **Delivery**: Seller ships the item and provides tracking info in the chat.
5. **Release**: Seller receives funds once the buyer confirms receipt.

### 2. The Bargain Hunter (Buyer)
1. **Discovery**: Buyer searches for items and follows interesting auctions.
2. **Bidding**: Buyer places a bid; if outbid, they receive a real-time notification.
3. **Winning**: Upon winning, the buyer pays the total (Price + Delivery + Comm) into escrow.
4. **Completion**: Buyer confirms receipt to release funds to the seller.

## Feature Capability Map

| Feature | Description | Status |
|---------|-------------|--------|
| **Anti-Snipe** | Extends auction by 2 mins if a bid is placed in the final seconds. | Live |
| **Buy It Now** | Instant purchase that bypasses the bidding process. | Live |
| **Real-time Chat** | Secure communication unlocked only after escrow is funded. | Live |
| **Dispute Center** | Admin interface to hold, refund, or release escrowed funds. | Live |
| **Gamification** | Badges and levels for active buyers and sellers. | Live |

## Known Limitations

- **Bangladesh-Only**: Currently hardcoded for +880 phone numbers and BDT currency.
- **Manual Dispute Initial**: Some dispute workflows require manual admin intervention.
- **No Native App**: Highly performant PWA, but lacks native push notification depth on iOS.

## FAQ for PMs

**How is shill bidding prevented?**
We use real-time monitoring and mandatory phone verification. Suspicious patterns are flagged in the Admin Dashboard for manual review.

**Can a seller cancel an auction?**
Only if there are no bids. Once a bid is placed, the auction is legally binding unless a moderator intervenes.

**What happens if a buyer doesn't pay?**
The buyer's reputation score drops, and they may be temporarily banned from bidding. The item is offered to the second-highest bidder.

## Related Pages

| Page | Relationship |
|------|-------------|
| [Executive Guide](./executive-guide.md) | High-level strategy and ROI |
| [Feature Roadmap](../roadmap.md) | Upcoming features and milestones |
| [Architecture Overview](../architecture.md) | Technical constraints and capabilities |
