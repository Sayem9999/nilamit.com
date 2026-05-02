# src — Agent Instructions

## Overview
This directory contains the core application code for Nilamit. It is structured into actions (controllers), services (business logic), and lib (infrastructure). The platform implements a bifurcated account model (Personal/Business) and an eBay-style trust system.

## Structure
- `actions/` — Server Actions. Thin wrappers that handle auth and input validation.
- `services/` — Pure business logic services. Framework-agnostic where possible.
- `app/` — Next.js routing and UI layout.
- `components/` — Reusable React components, organized by domain.
- `lib/` — Shared utilities (auth, db, auction-logic).
- `types/` — Shared TypeScript definitions (User, SellerPublic, Auction).

## Conventions
- **Account Bifurcation**: All new user-facing features must respect the `isRetailer` flag. Business accounts use the **Indigo** theme; Personal accounts use **Charcoal/Black**.
- **Trust Metrics**: Use `salesCount` and `defectCount` to calculate `isTopRated` status (10+ sales, ≤5% defects).
- **Controllers (Actions)**: Each action should be a thin wrapper around a service call. Use Zod for all input validation.
- **Services**: All complex logic (transactions, calculations, tiered commissions) MUST live in services or `lib/auction-logic.ts`.
- **Error Handling**: Actions must return `ServiceResponse` objects; never throw to the client.

## Boundaries
- ✅ **Always do**: Use the Service layer for logic. Check `isRetailer` for role-based UI.
- ⚠️ **Ask first**: Changing tiered commission logic in `lib/auction-logic.ts`.
- 🚫 **Never do**: Add global administrative settings for logic that should be tiered or rule-based.
