# Changelog

All notable changes to the Nilamit platform will be documented in this file.

## [2.3.0] - 2026-05-04 (Current)
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
