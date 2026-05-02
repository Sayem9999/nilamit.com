# src — Agent Instructions

## Overview
This directory contains the core application code for Nilamit. It is structured into actions (controllers), services (business logic), and lib (infrastructure).

## Structure
- `actions/` — Server Actions. Thin wrappers that handle auth and input validation.
- `services/` — Pure business logic services. These are framework-agnostic where possible.
- `app/` — Next.js routing and UI layout.
- `components/` — Reusable React components, organized by domain.
- `lib/` — Shared utilities, database clients, and configuration.
- `types/` — Shared TypeScript definitions and interfaces.

## Conventions
- **Controllers (Actions)**: Each action should be a thin wrapper around a service call.
- **Services**: All complex logic (transactions, calculations) MUST live in services.
- **Error Handling**: Actions catch errors and convert them to `ServiceResponse` objects.
- **State**: Prefer server state and RTDB for real-time updates over complex client-side state.

## Boundaries
- ✅ **Always do**: Keep logic in `services/`. Use Zod for all input validation in `actions/`.
- ⚠️ **Ask first**: Creating new top-level directories in `src/`.
- 🚫 **Never do**: Cross-importing between services if it creates circular dependencies.
