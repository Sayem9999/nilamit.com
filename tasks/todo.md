# Project Tasks (v2.1 Professionalized)

> Last Updated: May 2, 2026

## 6. Retailer Professionalization (v2.1) [COMPLETED]
- [x] **Account Bifurcation**: Separate entry paths for Personal and Business accounts at registration.
- [x] **Business Branding**: Distinct Indigo theme and "Shop Name" support for retailers.
- [x] **eBay Trust Architecture**: Implementation of "Top Rated" (Gold Shield) and "Business Retailer" status.
- [x] **Performance Metrics**: Real-time tracking of `salesCount` and `defectCount` in user sessions.
- [x] **Proxy Bidding**: Integrated automated maximum bid logic into the bidding engine.
- [x] **Second Chance Offers**: Enabled sellers to offer items to underbidders on closed auctions.
- [x] **Logic Synchronization**: Removal of centralized commission settings in favor of logic-driven tiered rates.

## 0. Identity & Verification Hardening (High Priority)
- [x] Refactor Auth.js for Hybrid Credentials (Phone + Email).
- [x] Implement Multi-Step Standalone OTP verification flow.
- [x] Create `VerificationGuard` (Activity Gate) for Bidding/Selling/Chatting.
- [x] Update User Profile with dedicated Verification Center.
- [x] Extend NextAuth types for verification status persistence.

## 1. Advanced Search & Filtering
- [x] Create `/search` route and page component.
- [x] Implement Firestore search queries (term, category, status).
- [x] Implement Sorting logic (Ending Soon, Price).
- [x] Connect Navbar Search Input to the new page.

## 2. User Dashboard & Watchlists
- [x] Create `toggleWatchlist` server action.
- [x] Create `WatchlistButton` component.
- [x] Add Watchlist button to `AuctionCard`.
- [x] Build `/dashboard` page framework (Tabs/Sidebar).
- [x] Implement "Active Bids" data fetching and UI.
- [x] Implement "Watchlist" data fetching and UI.
- [x] Implement "My Auctions" (Seller Hub) data fetching and UI.

## 3. Image Optimization & Galleries
- [x] Build `ImageGallery` component.
- [x] Integrate `ImageGallery` into `AuctionDisplay` for listings with multiple photos.
- [x] Ensure all images are using optimized `next/image` tags.

## 4. Production Hardening & Performance (v1.7)
- [x] Implement **Authorized PII Gating** for seller/winner contact info.
- [x] Implement **Magic-Byte Image Validation** (sniffing) for secure uploads.
- [x] Implement global **Security Headers** (CSP, HSTS) at middleware level.
- [x] Implement **Request-Level Caching** via React `cache()`.
- [x] Implement **Memoization** for high-frequency list components.
- [x] Implement **Lazy Loading** for heavy modals and gateways.
- [x] Optimize **Shill Bidding Detection** for high-volume scalability.
- [x] Add **Sort-Field Allowlisting** for public listing queries.
- [x] Implement **Real CSV Parsing** and template download for Bulk Upload.

## 5. The Elite Phase (Road to 100%)
- [x] **Advanced Gamification**: XP (Levels) and Winning Streaks.
- [x] **Public Trust Center**: Redesign profile/seller pages with Gamification components.
- [x] **Automated Payment Stubs**: Automated escrow verification.
- [x] **Policy Enforcement Bot**: Auto-ban "Non-Paying Winners" and trigger **Second Chance Offers**.

## 7. Logistics & Stability (v2.2) [COMPLETED]
- [x] **Zero-Loss Logistics**: Formalize 120 BDT RTO deduction to protect sellers.
- [x] **Escrow Synchronization**: Hardened coordination service with hydrated state.
- [x] **Infrastructure Stabilization**: Fixed 20+ sequential build/type errors.
- [x] **Lint-Driven Quality**: Enforced zero-any policy across the service layer.
- [x] **Production Deployment**: Successfully triggered and verified production build pipeline.
