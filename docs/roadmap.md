# 🗺️ Nilamit Strategic Roadmap

> Last Updated: June 9, 2026
> See `docs/ENTERPRISE_GAPS.md` for the code-verified capability status table.

## Phase 1: Foundation (Q1 2026) — COMPLETED ✅
- [x] Initial Next.js scaffold and Firestore setup.
- [x] Email authentication.
- [x] Basic auction listing and bidding flow.
- [x] Image upload via Uploadthing.

## Phase 2: Trust & Coordination (v1.7.0) — COMPLETED ✅
- [x] **StarMap Constellation**: Real-time social trust visualization (D3.js).
- [x] **Escrow Coordination Hub**: Transaction-gated logistics and PII-shielded chat.
- [x] **Dispute Resolution Engine**: Admin-facing conflict management and atomic fund resolution.
- [x] **Reputation Engine**: Global leaderboard and trust-tier stratification.
- [x] **Monetization v1.5**: Tiered success fee engine integration.

## Phase 3: Financial & Scaling (Q2 2026) — COMPLETED ✅
- [x] **Escrow Shield 2.0**: Direct bKash/Nagad integration for automated advance holds.
- [x] **SMS-Gateway Hardening**: Integration with premium local providers for 99.9% OTP delivery.
- [x] **Advanced Moderation**: Automated flagging of suspicious bidding patterns (shill bidding detection).
- [x] **Global Marketplace Optimization**: Removed hyper-local circles to maximize auction visibility.

## Phase 4: AI & Ecosystem (Q3-Q4 2026)
- [ ] **Auto-Moderator**: AI-driven fake listing detection.
- [ ] **Smart Pricing**: Suggestions for sellers based on historical auction data. *(Note: `getSmartPricingSuggestion` action already exists — verify scope before reopening.)*
- [ ] **Voice Commerce**: Bangla voice-to-listing for non-literate sellers.
- [x] **Professional Logistics**: One-click courier booking — **env-gated, shipped** (`lib/courier.ts`, Steadfast adapter + `/api/courier/webhook`; activate with `COURIER_*` secrets). See `docs/ENTERPRISE_GAPS.md`.

## Phase 5: Scale infrastructure (provisioning, not building)

The code for these is shipped and env-gated; the remaining work is external
provisioning, not engineering:
- [ ] **Search at scale**: provision Typesense in-region (`docs/SEARCH_SELFHOST.md`) + backfill. Removes the keyword-search ceiling.
- [ ] **Online payments**: set SSLCommerz creds → featured + escrow advances take real money (`docs/PAYMENTS.md`).
- [ ] **Courier**: set `COURIER_*` creds → real shipment booking.
- [ ] **Pub/Sub fan-out**: provision topics once sustained bid volume warrants it.
- [ ] **Data locality**: measure TTFB-by-connection (Looker query #8), then co-locate compute in `asia-south1`/`asia-southeast1` (`docs/PERFORMANCE.md`).
