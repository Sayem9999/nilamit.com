# Nilamit — Agent Instructions

## Overview
Nilamit is a mobile-first, trust-focused C2C auction marketplace for Bangladesh. It uses a layered Service-Oriented Architecture (SOA) with Next.js Server Actions as controllers and pure domain services for business logic.

## Build & Run
- Install: `npm install` (then re-patch `@emnapi` per CLAUDE.md known issue)
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
- `src/lib/` — Infrastructure (Auth, DB, Logging, Rate Limiting, Logistics, Image Moderation).
- `src/types/` — Domain-driven modular type system.
- `src/app/` — Next.js App Router (pages and API routes). **No `[locale]` folder** — flat routing.
- `.github/workflows/cron.yml` — All scheduled jobs (no Cloud Scheduler).
- `docs/` — Technical documentation and architecture deep-dives.
- `memory/` — Project decisions, lessons, and deployment state.

## Code Style
- **TypeScript**: Strict typing required. Avoid `any`. CI lint fails on `@typescript-eslint/no-explicit-any`.
- **Server Actions**: Must return `ServiceResponse<T>`. Never throw to the client.
- **Services**: Business logic belongs here, not in Actions or Components.
- **Naming**: camelCase for functions/variables, PascalCase for components/classes.
- **i18n**: All UI text must use `next-intl`. **English-only** — only `messages/en.json` ships. To add a locale, update `src/i18n/routing.ts`, `src/i18n.ts`, and add a new messages file.
- **Comments**: Default to none. Add only when the WHY is non-obvious (hidden constraint, workaround for a specific bug).

### Example Server Action Pattern
```typescript
// src/actions/foo.ts
'use server';
import { auth } from '@/lib/auth';
import { mySchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function doSomething(input: unknown): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  const parsed = mySchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  try {
    await db.runTransaction(async (tx) => { /* ... */ });
    revalidatePath('/relevant-path');
    return successResponse(null);
  } catch (error) {
    log.error('[Action] doSomething failed', error);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}
```

## Boundaries
- ✅ **Always do**: Use the Service layer for business logic. Return `ServiceResponse`. Run `npx tsc --noEmit` and `npx vitest run` before pushing.
- ⚠️ **Ask first**: Changing database schemas (Firestore/RTDB), adding top-level dependencies, rotating secrets in Firebase Secret Manager, modifying CI workflows, deploying to production.
- 🚫 **Never do**: Write directly to Firestore from the client. Commit secrets to `.env` files. Use `Math.random()` for OTPs (use `crypto.randomInt`). Call `Storage.makePublic()` on user content.

## Branch & merge protocol
- `main` is unprotected, but operate as if it weren't: open a PR for review unless the user explicitly says "push direct to main".
- Pre-existing CI lint debt on `main` doesn't block merges, but **don't add to it** — your PR's diff must lint-clean.
- After merging to `main`, Firebase App Hosting auto-deploys via Cloud Build (`apphosting.yaml`). Allow 5–10 min before smoke-testing prod.

## Documentation
- **Project guide**: `CLAUDE.md` — primary reference for conventions, file map, state machines.
- **Wiki**: `docs/` — Architecture, security, deployment, audit reports.
- **Onboarding**: `docs/onboarding/` — Audience-tailored guides.
- **LLM Context**: `llms.txt` — Top-level project summary.
- **Session log**: `docs/SESSION_HANDOFF.md` — what was done, what's next, who's blocked on what.
