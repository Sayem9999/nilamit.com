# 💡 Lessons: Patterns & Anti-Patterns

> Last Updated: May 9, 2026

## Patterns to Follow
- **Transactional Bidding**: Always use `SELECT FOR UPDATE` to prevent race conditions.
- **Bengali UI Localization**: Use the `.bn` CSS class for high-contrast Bengali text.
- **Service-Layer Discipline**: Keep business logic in `services/` and thin wrappers in `actions/`.
- **Hydrated State Patterns**: Use hydrated interfaces for frontend components to ensure full type safety for complex entities.

## Lessons Learned (Anti-Patterns)
- **SVG Race Conditions**: 
    - *Issue*: Attaching D3 zoom hooks to an SVG before it is fully initialized leads to `ReferenceError`.
    - *Fix*: Ensure SVG selection and basic DOM structure are established before calling `.call(d3.zoom())`.
- **Next.js 15/16 Routing & Boundaries**:
    - *Lesson*: Mixing `next/dynamic` with `ssr: false` in Server Components causes build failures. 
    - *Fix*: Always mark components containing client-side dynamics with `'use client';`.
- **Strict Typing for Production**:
    - *Lesson*: Using `any` in business logic services often hides critical data structure mismatches that only surface in production builds.
    - *Fix*: Enforce `@typescript-eslint/no-explicit-any` and use specific interfaces for external data (e.g., Firestore Timestamps).
- **Consolidated Promise Handling**:
    - *Lesson*: Large `Promise.all` blocks with off-by-one destructuring block the TypeScript compiler.
    - *Fix*: Consolidate related data into single objects or use named properties.
- **Middleware & Auth.js v5 (CSRF/403)**:
    - *Lesson*: Internationalization middleware (`next-intl`) can intercept Auth.js internal API calls, causing CSRF failures (403 Forbidden).
    - *Fix*: Explicitly bypass locale middleware for all `/api/auth` routes.
- **Stale Client Sessions**:
    - *Lesson*: In Next.js App Router, `signOut` might not immediately clear all client-side state in the `SessionProvider` without a full page reload.
    - *Fix*: Supplement `signOut()` with `window.location.reload()` for absolute session termination.
- **Micro-Deposit Advance vs. Full Price**:
    - *Insight*: Full-price escrow creates buyer drop-off in the Bangladesh COD market.
    - *Solution*: Use a "Small Advance" (Success Fee + Delivery Charge) to unlock contact info, leaving the balance for COD settlement.
- **Seller COD Liability**:
    - *Insight*: Sellers lose money on delivery fees when buyers flake.
    - *Solution*: Use the platform-held Advance to reimburse the seller's courier fee in case of buyer-side cancellation (Zero-Loss Logistics).
- **Auth.js Callback Serialization with Firestore Timestamps**:
    - *Lesson*: Passing raw Firestore `Timestamp` objects through Auth.js JWT/Session callbacks triggers client-side serialization errors (e.g., `Error: Only plain objects can be passed to Client Components from Server Components`).
    - *Fix*: Explicitly detect `Timestamp` objects in auth callbacks and coerce them using `.toDate()` or cast them into serializable ISO strings/standard `Date` objects before returning the token.
- **Client-side Firebase Auth Sync & Reload**:
    - *Lesson*: Client-side Firebase Auth instances do not automatically update user metadata (like `emailVerified`) in real-time unless `.reload()` is explicitly called on the `currentUser`.
    - *Fix*: Call `await auth.currentUser.reload()` before checking `auth.currentUser.emailVerified` inside profile synchronization hooks to capture native, client-side email verification states accurately.
- **Framer Motion Layout horizontal overflow in Ticker**:
    - *Lesson*: Ticker elements wrapped in `AnimatePresence` with `mode="popLayout"` without a `flex` container parent will stack vertically instead of flowing horizontally.
    - *Fix*: Ensure ticker wrappers use `flex items-center gap-2` to support continuous horizontal flow.
- **Bidding System Clarity vs Proxy Bidding**:
    - *Lesson*: Users can easily misinterpret proxy bidding as a bug when they place a large bid and the price only increments slightly.
    - *Fix*: Provide clear tooltips or explainers in the UI (or in developer handoffs) explaining that max bids are kept private, and keep direct bidding as a secondary option rather than hard-disabling proxy logic unless specifically required.
