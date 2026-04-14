# ⚖️ Decisions: Project Governance & Versions

## Core Decisions
- **Mobile-First Orientation**: Target Bangladeshi market on low-bandwidth (3G/4G). No feature ships without mobile viewport validation.
- **Trust Anchor**: Phone number (+880) is the non-negotiable identity anchor.
- **Currency**: Strictly BDT (৳).
- **Timezone**: `Asia/Dhaka` (UTC+6).

## Version History
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
- **English-First Pivot (Apr 13)**: Core design and technical terminology shifted to English to align with global standards.
- **Trust-Based Escrow**: Success fees and delivery charges are held from buyers if the seller isn't Verified.
- **Anti-Sniping (Soft Close)**: 2-minute auto-extension on late bids.
