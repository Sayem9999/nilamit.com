# 📜 Rules: Agent Operational Constraints

## Core Technical Rules
1. **Bengali-First (bn)**: Use high-contrast Bengali text for all user-facing technical labels to ensure accessibility for non-technical merchants.
2. **Atomic Bidding**: All price updates must happen within a database transaction using `SELECT FOR UPDATE`.
3. **Trust Hooks**: Every user session requiring trust must anchor to a verified identity (Phone or Email). High-value actions are gated via `VerificationGuard`.
4. **Environment**: Primary development is local Windows; Production deployments are tunneled via Tailscale Funnel.

## Coding Style
- **Server Actions**: Use for all data mutations. Never expose database URLs or raw Firestore queries to the client.
- **Error Handling**: Return clean, localized error messages to the UI.
- **SVG Management**: Initialize SVG elements before attaching zooming hooks (specifically in the StarMap component) to avoid `ReferenceError`.

## Trust Protocols
1. **Advance-First Privacy**: Never release PII (Phone/Location) until the Escrow Advance is confirmed. Verified sellers bypass this gate.
2. **Seller Delivery Shield**: All advances must include the Seller's delivery charge to protect against buyer ghosting.
3. **Escrow Neutrality**: Platform holds success fees in HELD state until buyer confirms COD receipt.
4. **Activity Gate**: Bidding, creating auctions, and peer-to-peer chatting are strictly blocked for unverified users to prevent fraud and spam.

## Architecture Policy
- **Mobile First**: Every UI change must be validated for viewports as small as 4.5" (320px width).

