# Project Tasks (v1.6 Hardened)

> Last Updated: April 29, 2026

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
