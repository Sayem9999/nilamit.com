# Changelog

All notable changes to the Nilamit platform will be documented in this file.

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
