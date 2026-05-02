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
- **Zero-Loss Logistics**: All logistics coordination must respect the 120 BDT RTO deduction rule in the escrow service.
- **Strict Typing**: Never use `any`. Use specific interfaces or `unknown` with type guards. Enforced by `@typescript-eslint/no-explicit-any`.
- **Standardized Payloads**: All frontend components must use `Hydrated` types (e.g., `HydratedEscrowTransaction`) to ensure data consistency between frontend and backend.

## Boundaries
- ✅ **Always do**: Use the Service layer for logic. Check `isRetailer` for role-based UI.
- ⚠️ **Ask first**: Changing tiered commission logic or the 120 BDT RTO fee.
- 🚫 **Never do**: Use `any`. Add global administrative settings for logic that should be rule-based.
