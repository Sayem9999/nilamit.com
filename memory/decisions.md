# ⚖️ Decisions: Project Governance & Versions

## Core Decisions
- **Mobile-First Orientation**: Target Bangladeshi market on low-bandwidth (3G/4G). No feature ships without mobile viewport validation.
- **Trust Anchor**: Phone number (+880) is the non-negotiable identity anchor.
- **Currency**: Strictly BDT (৳).
- **Timezone**: `Asia/Dhaka` (UTC+6).

## Version History
- **v1.5 (Current)**:
    - Comprehensive hardening of Social Circles.
    - Admin dashboard enhancements (Moderation, System, Users).
- **v1.3**:
    - Finalized Admin Tab functionality.
- **v1.2**:
    - Bulk image upload via Uploadthing.
    - Auction reporting system implemented.
- **v1.1**:
    - SMS trust anchors.
    - Initial transactional bidding engine.

## Policy Choices
- **PSSA 2024 Compliance**: Platform must be Bengali-first to ensure transparency for non-technical users.
- **Escrow-Style Settlements**: 10% platform fee deducted upon successful auction close.
