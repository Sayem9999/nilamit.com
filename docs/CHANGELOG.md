# Changelog

All notable changes to the Nilamit platform will be documented in this file.

## [3.0.1] - 2026-06-12 (Latest)
### Security 🔒
- **Closed 4 unauthenticated public endpoints** created by the `'use server'` directive: deleted dead `actions/gamification.ts` (self-award XP/badges) and `actions/email-server.ts` (arbitrary-recipient email spam); stripped the directive from `lib/rating.ts` (public rating-recompute write-trigger); removed `export { auth }` from `actions/admin/ops.ts`. Codified as CLAUDE.md critical rule #19.
- **Open redirect fixed**: `/en//evil.com` resolved off-origin via a protocol-relative URL after legacy-prefix stripping; query strings on `/en/*` redirects now preserved.
- **Smart-pricing action** auth-gated + per-user rate-limited (was an anonymous Firestore-read amplifier).
- **Escrow `providerRef`** (buyer-typed MFS TrxID) now validated (trim / 64-char cap / charset) before reaching Firestore, the ledger, and admin screens.
- **Payment webhook**: JSON trigger with a bad secret now returns 401 instead of crashing into a 500 on a consumed request body.

### Fixed 🐛
- **Admin broadcast reached only migrated users**: `where('isBanned','!=',true)` excludes docs missing the field — legacy accounts were silently skipped. Now recency-ordered fetch with in-app ban filtering.
- **Admin panel**: tab deep-linking via URL hash (refresh/back/share keep the tab), mobile drawer backdrop + Escape, ARIA labels + focus rings, Treasury tooltip rendered (was inside `className`), fabricated Treasury metrics replaced with real counts, dead Export Ledger button now exports CSV, thousands separators on overview stats.
- **Homepage CTA auth-aware**: logged-in users see "Start Selling" → `/auctions/create` instead of "Create Free Account" → `/login` (EN + BN).

See `docs/AUDIT_REPORT.md` → Session 3 for the full finding-by-finding table.

## [3.0.0] - 2026-06-12
### Added 🆕
- **External search engine (env-gated)**: Typesense adapter removes the 1000-doc in-memory keyword-scan ceiling — engine returns ranked ids, Firestore stays source of truth, reader self-heals stale statuses. Backfill script + `docs/SEARCH.md` + self-host runbook. Dormant until `TYPESENSE_*` set.
- **Payments init (SSLCommerz)**: `POST /api/payments/sslcommerz/init` + `src/lib/sslcommerz.ts` — hosted-checkout sessions for `featured` purchases and `escrow` advances. Returns 503 `GATEWAY_OFF` until store credentials are set.
- **Featured listings end-to-end**: pricing tiers + `feat_` tran codec, idempotent amount-guarded activation via the payment callback, hourly `expire-featured` cron, seller purchase UI on the auction page.
- **Courier integration (env-gated)**: Steadfast adapter books real shipments in `createLogisticsOrder`; `/api/courier/webhook` feeds status back; falls back to internal tracking without `COURIER_*`.
- **Escrow gateway + logistics-on-confirm**: `initEscrowGatewayPayment` seeds the automation token; `verifyAndReleaseEscrow` now creates the logistics order on gateway settlement (the automated path previously skipped shipping).
- **Firebase phone OTP verification**: invisible reCAPTCHA → SMS → code, linked to the session-bound Firebase user; server verifies the ID token with UID binding + per-number uniqueness. Activate by enabling the Phone provider in Firebase Console.
- **Live auction share cards**: `GET /api/share-card/{auctionId}` — branded 1200×630 PNG with the current bid + countdown (or green SOLD result card), surfaced via the Share menu. Built for the FB-group/WhatsApp posting playbook (`docs/GROWTH.md`).
- **Growth instrumentation**: `user_signup` / `auction_created(firstListing)` / `user_verified` events → BigQuery; Looker growth-pulse + seller-activation queries; dynamic sitemap with every ACTIVE listing; RUM now captures connection type (TTFB-by-connection locality query).

### Changed 🎨
- **Design-system overhaul** (visually verified): one radius (`rounded-md`) across 89 files, 11px type floor (was 8–10px), `backdrop-blur` removed from repeated scroll-path elements, visible primary hover (500/600 were the same hex), duplicate Google-Fonts `@import` removed.
- **Cold-start-aware landing page**: how-it-works/escrow story moves above the fold when no auction rails exist; StatsBar hidden until numbers are a trust signal; loading skeletons on browse/profile/seller/leaderboard/social.
- **Empty states sell supply**: zero-inventory listings show "Be the first to sell"; auction-not-found is a recovery page; hero "Ending Soon" husk swaps to How-it-works; member-count trust strip threshold-gated.

### Fixed 🐛
- Admin delete/takedown/suspend now clear tag caches (`revalidateTag('auctions')`) and sync the search index — cached homepage rails no longer link to deleted auctions.
- KYC moderator queue mints fresh 1-hour signed URLs (documents older than the 7-day upload window no longer 404).
- Invalid `text-slate-350` class; stale `STYLE.md`/`ENTERPRISE_GAPS.md`/roadmap reconciled to code-verified reality.

## [2.6.0] - 2026-05-17
### Added 🆕
- **Dynamic Profile Photo Uploads**: Built an interactive client uploader component with instant hover overlay, responsive upload spinner, client-side WebP image compression (500x500 at 85% quality), and `/api/upload` API secure integration.
- **NextAuth Session Synchronization**: Synchronized avatar updates in real-time across the navbar and header utilizing NextAuth's `update()` API.
- **Google OAuth Avatar Synchronization**: Configured Auth.js JWT and Session callbacks to fetch, map, and persist Google account pictures to Firestore and token sessions automatically on login.
- **Featured Auction Toggle & Badging**: Added `DetailFeatureButton.tsx` to display Featured indicators on the auction details page alongside the Watchlist toggle, with active toggle capability for administrators.

### Fixed 🐛
- **Auction Card Button Collision**: Resolved overlap issues between "Watchlist" and "Featured" buttons on `AuctionCard` image overlays by wrapping absolute actions in a unified CSS Flexbox row with `gap-2`.
- **System Verification**: Updated the test runner config to execute all **68 / 68 unit tests** with 100% success and 0 compiler warnings.

## [2.5.0] - 2026-05-15
### Added 🆕
- **Modular Service Architecture**: Decomposed monolithic `AuctionService` and `BiddingService` into a scalable facade pattern with specialized `Reader`, `Writer`, `Processor`, and `Notifier` modules.
- **Security Hardening**: Implemented a global strict **Content Security Policy (CSP)**, Upstash-backed **sliding-window rate limiting** for auth/bidding, and isomorphic **PII filtering** for user-generated content.
- **High-Performance Cleanup**: Cleared ~1.5GB of build artifacts and temporary data (`.claude/worktrees`, `.next` cache) to optimize system footprint.

### Fixed 🐛
- **UI Redundancy**: Merged duplicate `SecondChance` button components into a single, polished `SecondChanceOfferButton` with a consistent confirmation workflow.
- **Transactional Integrity**: Restored and isolated the complex Proxy Bidding logic within the new `BidProcessor` module, ensuring robust concurrency handling.
- **Type Safety**: Fixed path alias resolution issues in the new service layer and achieved 100% type coverage for modular facades.

## [2.4.0] - 2026-05-06
### Added 🆕
- **Firestore Brute-Force Shield**: Enforced transactional state check limits of maximum 5 attempts for OTP code-space verification directly in Firestore.
- **GCP Secrets Integration**: Added live Redis credentials in GCP Secret Manager to activate high-throughput sliding-window rate limiting.
- **Automated Firestore CI/CD Pipeline**: Added automated deployment of Firestore rules and indexes during both local git push hook actions and GitHub Actions CI pipelines on pushes to `main`.
- **Local bKash/Nagad SVGs**: Localized financial brand media in `/public` directory to guarantee high-performance, CSP-compliant logo rendering.

### Fixed 🐛
- **Fail-Open Rate Limiter**: Prevented false login/register lockouts for users on setups with missing Upstash secrets by shifting to a secure fail-open strategy with Sentry reporting.
- **Zero-Dependency Image Uploads**: Bypassed Firebase custom token client-side configuration dependency failures by routing all photo uploads server-side via Admin SDK.
- **Dynamic Self-Healing Landing Stats**: Decoupled homepage metrics from placeholders and populated them with real, performant Firestore count queries.

## [2.3.0] - 2026-05-04
### Added 🆕
- **Auth Hardening**: Implemented `AUTH_TRUST_HOST` and explicit sign-out revalidation to ensure session consistency in proxied environments.
- **Image Domain White-listing**: Added `unsplash.com` to Next.js remote patterns to support high-fidelity mockup assets.

### Fixed 🐛
- **Auth Middleware 403**: Resolved critical CSRF/Forbidden errors by bypassing locale middleware for `/api/auth` routes.
- **Landing Page Data**: Fixed Firestore collection/doc name mismatch for `systemConfig` (switched from `settings/system` to `systemConfig/default`).
- **Missing Chunks (404)**: Hardened client-side routing to handle build-time chunk removal during live deployments.

## [2.2.0] - 2026-05-03

### Added 🆕
- **Zero-Loss Logistics Model**: Formalized the 120 BDT RTO (Return to Origin) deduction policy to protect sellers from courier fee losses during frivolous rejections.
- **Hydrated State Patterns**: Introduced standardized hydrated interfaces for complex entities (e.g., `HydratedEscrowTransaction`) to ensure frontend data consistency.

### Fixed 🐛
- **Infrastructure Stabilization**: Resolved 20+ sequential production build failures related to client/server boundaries, module resolution, and TypeScript type mismatches.
- **Strict Type Enforcement**: Eliminated `any` type casts across the service layer and enforced `@typescript-eslint/no-explicit-any`.
- **Date Handling**: Hardened Firestore Timestamp to JS Date conversion logic in `BiddingService` to prevent build-time crashes.
- **Landing Page Destructuring**: Resolved a critical `Promise.all` mismatch that blocked the production build.

## [2.1.0] - 2026-05-02

### Added 🆕
- **Bifurcated Registration**: Separation of Personal and Business accounts at entry with tailored UI themes (Charcoal vs Indigo).
- **eBay-style Trust Architecture**: Integrated **"Top Rated"** gold shields and **"Business Retailer"** badges based on sales volume and defect rates (≤ 5%).
- **Advanced Bidding Logic**: Implementation of **Proxy Bidding** (Auto-Max) and **Second Chance Offers**.
- **Session Performance Metrics**: Live tracking of `salesCount` and `defectCount` synchronized with user sessions.
- **Retailer Tooling**: Dashboard-integrated tools for verified businesses, including bulk inventory management.

### Removed 🔥
- **Centralized Commission Config**: Deleted redundant global admin setting in favor of logic-driven tiered rates (2.5%, 1.5%, 1%) defined in `lib/auction-logic.ts`.

### Fixed 🐛
- **UI/UX Synchronization**: Unified labels and themes across the platform to distinguish between personal and commercial transactions.
- **TypeScript Alignment**: Achieved 100% type safety for new retailer and trust features across the entire platform surface.

## [2.0.0] - 2026-05-02

### Added 🆕
- **Service-Layer Architecture**: Decoupled business logic from Server Actions into `src/services/`.
- **Modular Domain Design**: Decomposed monolithic action and type files into domain-specific modules.
- **eBay-Style Features**: Proxy Bidding, Reserve Prices, Item Condition, and Enhanced Logistics.
- **Financial Tools**: PDF Invoicing, Revenue Dashboard, and Dispute Hold/Refund capabilities.
- **Observability**: Integrated Sentry with Session Replay and performance tracing.
- **Onboarding Guides**: New audience-tailored guides for Contributors, Staff Engineers, Executives, and PMs.
- **LLM Context**: Added `llms.txt` and `AGENTS.md` files for improved AI agent productivity.

### Fixed 🐛
- **Production Build Stabilization**: Resolved recursive `next-auth` type definitions and forced dynamic rendering for critical pages.
- **Environment Resiliency**: Implemented aggressive URL sanitization and Zod-based config validation for production secrets.
- **Auth Hardening**: Standardized OTP lengths, phone validation, and `trustHost` multi-domain support.
- **Inventory Parser**: Resolved type mismatches and Zod error access in bulk upload processing.
- **Sentry Integration**: Fixed source map upload permissions and configuration conflicts.

### Security 🛡️
- **Granular PII Authorization**: Implemented strict gating for seller contact info.
- **Secure Uploads**: Added magic-byte validation for image uploads.
- **Hardened Middleware**: Enhanced CSP headers, HSTS, and X-Frame-Options.

### Refactored 🔄
- **API Contracts**: Standardized all backend actions to return `ServiceResponse<T>`.
- **Database Logic**: Optimized Firestore transactions and RTDB event bus triggers.

---

## [1.7.0] - 2026-04-30 (Previous Stable)
- **Escrow Coordination Hub**: Transaction-gated logistics and PII-shielded chat.
- **StarMap Constellation**: Real-time social trust visualization.
- **Reputation Engine**: Global leaderboard and trust-tier stratification.
