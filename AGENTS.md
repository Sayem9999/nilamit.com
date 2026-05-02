# Nilamit — Agent Instructions

## Overview
Nilamit is a mobile-first, trust-focused C2C auction marketplace for Bangladesh. It uses a layered Service-Oriented Architecture (SOA) with Next.js Server Actions as controllers and pure domain services for business logic.

## Build & Run
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type Check: `npx tsc --noEmit`

## Testing
- Unit Tests: `npx vitest run`
- E2E Tests: `npx playwright test`

## Project Structure
- `src/actions/` — Server Actions (API entry points). Auth gated and input validated via Zod.
- `src/services/` — Pure business logic. Decoupled from the HTTP layer.
- `src/lib/` — Infrastructure (Auth, DB, Logging, Rate Limiting).
- `src/types/` — Domain-driven modular type system.
- `src/app/` — Next.js App Router (pages and API routes).
- `docs/` — Technical documentation and architecture deep-dives.
- `memory/` — Project decisions, lessons, and deployment state.

## Code Style
- **TypeScript**: Strict typing is required. Avoid `any`.
- **Server Actions**: Must return `ServiceResponse<T>`. Never throw to the client.
- **Services**: Business logic belongs here, not in Actions or Components.
- **Naming**: camelCase for functions/variables, PascalCase for components/classes.
- **i18n**: All UI text must use `next-intl` (en/bn).

### Example Service Pattern
```typescript
// src/services/bidding/bidding-service.ts
export class BiddingService {
  static async placeBid(auctionId: string, userId: string, amount: number) {
    // 1. Validate rules
    // 2. Atomic Firestore transaction
    // 3. Update RTDB for real-time feedback
    // 4. Return result
  }
}
```

## Boundaries
- ✅ **Always do**: Use the Service layer for business logic. Return `ServiceResponse`. Run lint/type-check before committing.
- ⚠️ **Ask first**: Changing database schemas (Firestore/RTDB). Adding new top-level dependencies.
- 🚫 **Never do**: Write directly to Firestore from the client. Commit secrets to `.env` files. Push directly to `main`.

## Documentation
- Wiki: `docs/` — Architecture, API, and setup guides.
- LLM Context: `llms.txt` — Project summary for coding agents.
- Onboarding: `docs/onboarding/` — Audience-tailored guides.
