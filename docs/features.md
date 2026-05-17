# 🚀 Nilamit Platform Features
# 🚀 Nilamit Platform Features

> Last Updated: April 29, 2026

Nilamit is a high-performance, real-time C2C auction marketplace designed for trust, speed, and visual excellence.

## 1. Real-time Auction Engine
- **One-Time Soft-Close**: Automatically extends auction time *once* by 2 minutes if a bid is placed in the final window, ensuring fair price discovery.
- **Proxy Bidding (Auto-Max)**: Users can set a maximum bid, and the system automatically outbids competitors up to that limit.
- **Proactive Alerts**: Firebase RTDB notifications for outbid status and custom target-price hits.
- **Bifurcated Onboarding**: Separate entry paths for **Personal** and **Business** accounts at signup, each with tailored UI themes (Charcoal vs Indigo).

## 2. Social Proof & Trust Architecture (StarMap)
- **Trust Constellation (StarMap)**: A dynamic D3.js engine mapping the marketplace's "Social Fabric."
  - **Node Physics**: Nodes scaled by `reputationScore` with aura effects for Verified Merchants.
  - **Link Semantics**: Distinction between `SALE` (confirmed transaction) and `INTEREST` (shared bidding history).
  - **Interactive Discovery**: Floating tooltips and direct navigation to seller profiles via social nodes.
- **eBay-style Performance Status**:
  - **Top Rated Plus (Gold Shield)**: Earned by sellers with 10+ completed sales and a defect rate ≤ 5%. Provides 10% commission discounts.
  - **Business Retailer (Indigo Shield)**: Professional account status for registered shops and bulk sellers.
- **Elite Leaderboards**: Global stratification for performance-based badges and high-stakes trade recognition.
- **Win-First Privacy**: Seller contact details are strictly hidden until an auction is won.

## 3. Trust & Coordination Layer
- **Coordination Hub (COD Optimized)**: Purpose-built for the Bangladesh **Cash on Delivery (COD)** market. Nilamit handles the escrow 'hold' and reputation, while users handle their own logistics.
- **Success Fee Engine**: Automated, tiered platform fees (1% - 2.5%) for successful sales.
- **Seamless OAuth & Email Onboarding**: Unauthenticated browsing with secure authentication options via **Email or Google OAuth**, featuring automatic profile avatar synchronization on Google login.
- **Premium Profile Avatar Management**: Sleek, client-side profile picture upload widget with client-side WebP image optimization (500x500 at 85% quality), real-time NextAuth session updates, and Cloud Vision SafeSearch secure backend moderation.
- **Category Feeds**: "For You" and "Ending Soon" feeds tailored to user interests.

## 4. Discovery & Personalization
- **Smart Search**: Hybrid keyword + semantic ranking for relevant results.
- **Personalized Watchlists**: Real-time tracking of desired items.

## 5. Escrow Coordination Hub
- **Transaction-Gated Chat**: Secure, real-time coordination channels unlocked only after an escrow advance is `HELD`.
- **Integrated Controls**: Quick-action sidebars for `Confirm Receipt` and `Raise Dispute` within the chat context.
- **PII Shielding**: Automatic real-time filtering of sensitive contact details to prevent leakages.
- **Media Verification**: Support for image documentation for logistics proof.

## 6. Financial & Escrow Layer
- **Escrow Shield**: Trust-tiered escrow. Verified sellers get instant holds; unverified sellers require a confirmed advance (Commission + Delivery) before coordination unlocks.
- **Success Fee Engine**: Automated, tiered commission logic (2.5%, 1.5%, 1%) integrated into the auction closing loop.

## 7. Real-time Proactive Alerts
- **Price Target Alerts**: One-time notifications triggered exactly when a custom user-defined threshold is met.
- **Outbid Follows**: Proactive signals for non-bidders or watchers who wish to track auction heat in real-time.
- **Desktop notifications**: High-visibility toasts with integrated navigation for immediate response.

## 8. Admin Conflict Management
- **Centralized Dispute Hub**: Real-time auditing of reported conflicts between Buyers and Sellers.
- **Atomic Resolutions**: Direct administrative tools to release or refund funds using protected Firestore transactions.
- **Dynamic Reputation Governance**: Automated reputation adjustments and **Defect Tracking** based on dispute outcomes.
- **Global Health Metrics**: High-level monitoring of total users, bids, and revenue streams.
- **Second Chance Management**: Tooling to monitor and validate private offers sent to underbidders.
