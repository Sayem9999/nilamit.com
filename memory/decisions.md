# ⚖️ Decisions: Project Governance & Versions

## Core Decisions
- **Mobile-First Orientation**: Target Bangladeshi market on low-bandwidth (3G/4G). No feature ships without mobile viewport validation.
- **Trust Anchor**: Phone number (+880) is the non-negotiable identity anchor.
- **Currency**: Strictly BDT (৳).
- **Timezone**: `Asia/Dhaka` (UTC+6).

## Version History
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
- **v1.3**:
    - Finalized Admin Tab functionality.
- **v1.2**:
    - Bulk image upload via Uploadthing.
    - Auction reporting system implemented.

## Policy Choices
- **PSSA 2024 Compliance**: Platform provides English-First experience with professional Bengali support to ensure transparency.
- **English-First Standard (v1.8.0)**: Core design, documentation, and technical terminology are English-first.
- **Trust-Based Escrow**: Success fees and delivery charges are held from buyers if the seller isn't Verified.
- **Anti-Sniping (Soft Close)**: 2-minute auto-extension on late bids.
