# 🧠 Nilamit Core Memory (Living Document)

## Project Vision
Nilamit is a specialized auction marketplace for the Bangladeshi market, prioritizing localized trust, mobile efficiency, and accessible social commerce.

## Architecture
- **Framework**: Next.js 15 (App Router)
- **State Management**: Server Actions + Real-time Polling (transitioning to WebSockets).
- **Persistence**: Prisma 7 + PostgreSQL (Supabase).
- **Locking Mechanism**: Row-level locking for atomic bid increments.

## Core Rules for Agents
1. **Bengali-First (bn)**: Use high-contrast Bengali text for user-facing technical labels.
2. **Atomic Bidding**: All price updates must happen within a transaction using `SELECT FOR UPDATE`.
3. **Trust Hooks**: Phone number is the anchor; Reputation Score is the engine.
4. **Environment**: Primary development is local Windows; Production is deployed via Tailscale Funnel.

## Maintenance Logs
- **v1.5**: Pushed comprehensive enhancements for Social Circles and Admin dashboards.
- **D3 Pattern**: Always initialize SVG elements before zooming hooks to prevent `ReferenceError`.

## Roadmap Reference
See [plan.md](file:///c:/nilamit.com/plan.md) for future feature tracking.
