# ⚖️ Decisions: Project Governance & Versions

> Last Updated: May 9, 2026

## Core Decisions
- **Mobile-First Orientation**: Target Bangladeshi market on low-bandwidth (3G/4G). No feature ships without mobile viewport validation.
- **Trust Anchor**: Hybrid identity (Phone number (+880) or verified email) is the identity anchor.
- **Currency**: Strictly BDT (৳).
- **Timezone**: `Asia/Dhaka` (UTC+6).

- **v2.4.0 (Aesthetics, Live Activity & Bidding Stabilization)**:
    - **Admin Control Expansion**: Added site-wide announcements, landing page hero marketing texts, and treasury bKash/Nagad number settings, fully integrated with blur-save events.
    - **Auction Listing UI Overhaul**: Redesigned layout to move category/condition overlay badges into text body container underneath titles to guarantee 100% item image visibility (eBay Style).
    - **Live Ticker Flex Fix**: Redesigned ticker component's flex dimensions (`flex items-center gap-2`) to avoid layout overlapping and show scrolling bids horizontally in real-time.
    - **Proxy Bidding Restoration**: Restored robust eBay-style proxy bidding calculations in `bid-processor.ts`, maintaining maximum bids hidden while dynamically scaling visible currents relative to competing boundaries.
- **v2.3.3 (Native Firebase Client Verification & Safe Auth)**:
    - **Native Firebase Verification**: Migrated from unstable third-party SMTP email verification (Resend) to native, zero-cost, highly-reliable Firebase Client-Side Auth email verification.
    - **Safe-Auth Object Coercion**: Patched database auth hooks and NextAuth callbacks to convert Firestore `Timestamp` objects into serializable `Date` objects, correcting NextAuth client-side serialization crashes.
    - **Pre-Token Profile Auto-Registration**: Configured token generator endpoints to auto-sync emails/display names to Firebase Auth records, resolving empty-profile email triggers.
    - **Secure Verified State Assertion**: Implemented custom server-action validation using Firebase Admin SDK to verify assertions before updating database records.
- **v2.3.2 (Verification Flexibilization)**:
    - **Hybrid Verification Model**: Allowed users to create auction listings, relist, or place bids if they have verified *either* their phone number or their email address (previously restricted to phone only).
- **v2.3.1 (Treasury Logic Hardening)**:
    - **Smart Logistics Protection**: Implemented the `refundWithDeduction` server action, replacing simulated logic in `TreasuryTab` with a production-ready resolution flow.
    - **Commitment Service Activation**: Integrated `CommitmentService` to handle atomic 120 BDT deductions for RTO protection.
- **v2.3.0 (Production Auth Stabilization & UI Restoration)**:
    - **Auth.js v5 Hardening**: Resolved 403 Forbidden errors by bypassing internationalization middleware for `/api/auth` routes.
    - **Infrastructure Trust**: Enabled `AUTH_TRUST_HOST` to handle Firebase App Hosting proxies correctly.
    - **Session Lifecycle Fix**: Forced full-browser reloads on sign-out to eliminate stale client-side session states.
    - **Landing Page Restoration**: Fixed Firestore collection mismatches and allowed external image domains (`unsplash.com`) for a high-fidelity Hero experience.
- **v2.2.0 (Zero-Loss Logistics & Infrastructure Stabilization)**:
    - **Zero-Loss Model**: Formalized the 120 BDT RTO (Return to Origin) deduction for frivolous rejections to protect sellers.
    - **Escrow Hardening**: Synchronized the escrow lifecycle with automated logistics coordination.
    - **Strict Type System**: Enforced `@typescript-eslint/no-explicit-any` across all services to prevent build-time regressions.
    - **Hydrated State Consolidation**: Simplified frontend data fetching by using standardized hydrated interfaces (e.g., `HydratedEscrowTransaction`).
    - **Infrastructure Resiliency**: Resolved 20+ sequential production build failures and optimized the Next.js standalone output configuration.

## Version History
- **v2.1.0 (Account Professionalization & Sync)**:
    - **Bifurcated Registration**: Separation of Personal and Business accounts at entry with distinct UI themes and data models.
    - **eBay-style Trust Architecture**: Implementation of "Top Rated" (Gold Shield) and "Business Retailer" status based on sales volume and defect rates (≤ 5%).
    - **Advanced Bidding Logic**: Integration of Proxy Bidding (Auto-Max) and Second Chance Offers.
    - **Admin Simplification**: Removed redundant global commission settings; platform now exclusively uses tiered logic.
    - **Session Synchronization**: Updated session objects to include real-time performance metrics (salesCount, defectCount).
- **v1.8.0 (Treasury Automation & Sync)**:
    - **Platform Treasury**: Unified platform accounts (bKash/Nagad) managed via Admin dashboard.
    - **Automated Escrow Engine**: Transitioned from manual simulation to automated `HELD` verification logic.
    - **Zero-Technicality Sync**: Eliminated blank/unlinked pages (FAQ, Safety, Contact) and synchronized whole-platform navigation.
    - **MD Standard Hardening**: English-first documentation overhaul across the entire repository.
- **v1.7.0 (Platform Hardening)**:
    - **Trust Constellation (StarMap)**: Integrated D3.js social fabric visualization with reputation-scaled link physics.
    - **Escrow Coordination Hub**: Locked post-auction logistics layer gated by `HELD` escrow state.
    - **Neutral Dispute Center**: Administrative interface for conflict resolution with atomic transaction support.
    - **UI Polish**: Simplified Navbar by removing legacy toggles; elevated "Dedicated Language Switcher."
- **v1.6 (Identity Hardening)**:
    - **Hybrid Identification**: Shifted from phone-only to hybrid identity (Phone/Email) as trust anchors.
    - **Verification Shield**: Introduced `VerificationGuard` and multi-step standalone phone verification.
- **v1.5**:
    - Comprehensive hardening of the bidding transaction engine.
    - Admin dashboard enhancements (Moderation, System, Users).

## Policy Choices
- **PSSA 2024 Compliance**: Platform provides English-First experience with professional Bengali support.
- **English-First Standard (v1.8.0)**: Core design, documentation, and technical terminology are English-first.
- **Trust-Based Escrow**: Success fees and delivery charges are held from buyers if the seller isn't Verified.
- **Anti-Sniping (Soft Close)**: 2-minute auto-extension on late bids.
