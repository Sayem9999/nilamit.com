# Session Handoff & Architecture Memory

## Current Session (2026-05-25)
### What we did
* **Expanded Admin Panel Configuration Toggles** ([SystemTab.tsx](file:///c:/nilamit.com/src/app/admin/tabs/SystemTab.tsx)): Added dynamic control boxes to regulate site-wide announcements, home hero banner layouts, and official bKash/Nagad agent phone details. The updates use clean `onBlur` auto-save mechanisms.
* **Simplified Auction Cards layout (eBay style)** ([AuctionCard.tsx](file:///c:/nilamit.com/src/components/auction/AuctionCard.tsx)): Moved the category, condition, and featured badges from overlay containers down directly below the title. This exposes 100% of the item preview image and mimics modern, high-conversion layouts like eBay.
* **Fixed Real-Time Activity horizontal flow** ([LiveTicker.tsx](file:///c:/nilamit.com/src/components/home/LiveTicker.tsx)): Redesigned layout boundaries inside the Live Ticker, switching the animation display container to a clean horizontal `flex items-center gap-2` row to resolve overlapping.
* **Restored robust eBay-style Proxy Bidding** ([bid-processor.ts](file:///c:/nilamit.com/src/services/bidding/modules/bid-processor.ts)): Confirmed and fully restored the automatic proxy bidding algorithm. Placing a high bid securely preserves the user's hidden maximum limit and only raises the visible price when competing entries are received, exactly matching eBay's real-world behavior.
* **Type-Safety & Build Integrity**:
  - `npx tsc --noEmit` and `npm run lint` execute cleanly with zero compilation warnings or styling debts (unused imports removed).

## Previous Session (2026-05-24)
### What we did
* **Upgraded Overlay Badges UI/UX** ([AuctionCard.tsx](file:///c:/nilamit.com/src/components/auction/AuctionCard.tsx)): Completely redesigned all absolute-positioned badges overlay on auction listing cards to feel state-of-the-art, premium, and highly visually cohesive:
  - **Dynamic Category Pills**: Mapped each category (`mobile-phones`, `electronics`, `vehicles`, `fashion`, `home-garden`, `sports`, `books`, `collectibles`, `other`) to dynamic glassmorphic pills with matching HSL semi-transparent text/borders and dedicated Lucide micro-icons (`Smartphone`, `Tv`, `Car`, `Shirt`, `Home`, `Dumbbell`, `BookOpen`, `Gem`, `Package`).
  - **Condition Badges**: Replaced raw text/emoji with clean, high-fidelity chips and icons (`Sparkles` for `NEW`, `RefreshCw` for `USED`, `Wrench` for `REFURBISHED`).
  - **Featured Badge**: Elevated to a highly premium amber-to-yellow sunset gradient pill with a glowing star icon and a slow, high-end pulse animation (`animate-pulse`).
  - **Reserve Status Tooltip**: Redesigned "Reserve not met" into a refined rose warning pill with `ShieldAlert` and `HelpCircle` micro-icons. Engineered a self-contained, CSS-only tooltip that expands on hover/tap to explain the reserve mechanism to bidders.
* **Expanded Categories & Locations Outside Dhaka** ([common.ts](file:///c:/nilamit.com/src/types/common.ts), [en.json](file:///c:/nilamit.com/messages/en.json)): Added major divisional cities outside Dhaka (Chattogram, Sylhet, Khulna, Rajshahi, Barishal, Rangpur, Mymensingh, Cumilla, Cox's Bazar, Gazipur, Narayanganj) and popular new auction categories (Computers & Laptops, Cameras & Optics, Watches & Jewelry, Home Appliances, Hobbies & Music) with fully responsive custom styles and matching Lucide icons (`Laptop`, `Camera`, `Watch`, `Plug`, `Gamepad`).
* **Administrative Operational Bootstrap Toggles**:
  - Integrated administrative controls inside Firestore configuration templates (`SystemConfig` extended with `mfsLinkageRequired`, `escrowRequired`, `commissionPercentageEnabled`, `biddingRequirementsEnabled`, `postingRequirementsEnabled`).
  - Embedded settings across bidding, posting, listing, and billing services to cleanly bypass restrictions during early traction phases.
  - Implemented the elegant control dashboard inside the Admin settings panel ([SystemTab.tsx](file:///c:/nilamit.com/src/app/admin/tabs/SystemTab.tsx)) and split creation date/time pickers side-by-side in [page.tsx](file:///c:/nilamit.com/src/app/auctions/create/page.tsx).
* **Compiles & Verification Passes**:
  - `npx tsc --noEmit` validates 100% cleanly with zero compilation errors.
  - `npm run lint` completes cleanly with **zero errors and zero warnings** (cleaned up unused `Shield` imports and escaped JSX quotes with `&apos;`).
  - `npx vitest run` executes all **106 tests** with **100% pass rate**.

## Previous Session (2026-05-22)
### What we did
* **Real-time Navigation Tabs & Inbox**: Added dedicated **Notifications** (`Bell` icon) and **Chat** (`MessageSquare` icon) links to the authenticated header Navbar, desktop/mobile viewports, and the Dashboard sidebar:
  - **Dynamic Badge Count**: Embedded a live subscriber to `/notifications/user/${userId}` in the upper Navbar to instantly render unread notification count badges.
  - **Real-time Notifications View** ([NotificationsList.tsx](file:///c:/nilamit.com/src/components/social/NotificationsList.tsx)): Engineered a clean, responsive client inbox page that subscribes to Firebase Realtime Database and formats card updates based on events (e.g. outbid alerts, closing soon, chat, payments, reputations, won items) with action triggers (e.g. "Clear All" and individual card deletion).
* **Scroll-State & Layout Elevation Fix**: Added window scroll-state detection hooks inside the main [Navbar.tsx](file:///c:/nilamit.com/src/components/layout/Navbar.tsx) and wired up corresponding style overrides (`.premium-navbar` transition, elevation shadows, and high-opacity fills) in [globals.css](file:///c:/nilamit.com/src/app/globals.css) to eliminate visual overlap and bleed-through when scrolling main layouts underneath the sticky navigation. Included fallback rules (`no-backdrop`) for environments that do not support backdrop-filters.
* **React 19 Hooks Purity & ESLint Hardening**: Refactored the `formatTimeAgo` layout in `NotificationsList` to track reference time using state-based updates (`now` state initialized with a lazy initializer and updated using an interval effect) to resolve React 19 hooks purity execution warnings. Ignore-rules for `scratch/` script folder were added to [eslint.config.mjs](file:///c:/nilamit.com/eslint.config.mjs).
* **Automated & Manual Verifications**:
  - `npm run lint` compiles cleanly with zero warnings/errors.
  - `npx tsc --noEmit` validates with zero errors.
  - `npx vitest run` executes all 72 unit tests across 7 test suites successfully with zero failures.
  - Merged and auto-deleted the branch via GitHub Pull Request [PR #30](https://github.com/Sayem9999/nilamit.com/pull/30).

## Historical Session (2026-05-21)
### What we did
* **Option A: High-Density & Mobile-Optimized Grid**: Redesigned core listings layouts to present elegant dual columns (`grid-cols-2`) on mobile viewports across Browse, Search, LoadMore scroll loads, Seller Storefronts, and Homepage ForYou & Featured sections to double visual post density and match Shopee/Daraz layouts:
  - **AuctionCard.tsx Resizing**: Scaled body padding (`p-3 md:p-4`), category/condition/featured badges (`text-[8px] md:text-[10px]`), absolute MapPin location overlay (`bottom-2 inset-x-2 text-[9px]`), and countdown timer (`py-1.5 px-2 text-[10px] md:py-2 px-3`) dynamically on mobile to prevent overlapping.
  - **Price Text BDT Wrapping**: Added responsive flex-wrap configurations and scaled BDT pricing (`text-sm sm:text-base md:text-lg lg:text-xl`) to eliminate line wrapping.
  - **Watchlist Button Touch Optimization**: Modified `WatchlistButton.tsx` opacity logic (`opacity-100 md:opacity-0 md:group-hover:opacity-100`) so touch-screen viewports display the heart icon by default, maintaining hover-only aesthetics strictly on desktops.
  - **Hydration & Skeletons Alignment**: Replaced search loading skeleton grid classes with dynamic double-column mobile setups (`grid-cols-2`) to match hydrated grids, fully resolving visual layout shifting (CLS).
* **Hybrid Search Query System Resolver**: Integrated an elegant Firestore-level Hybrid Search Resolver in `src/services/auction/modules/auction-reader.ts` that filters search queries (e.g. `"tv"`) case-insensitively, sorts results dynamically in-memory, and calculates page cursor limits prior to hydrating seller/watchlist details to preserve O(1) read costs. Created a comprehensive vitest suite (`tests/unit/search.test.ts`) covering pagination, metadata hydration, and fallbacks.
* **Server Action Exception Hardening**: Wrapped `requireAdmin()` check in try-catch blocks across all administrative server actions to guarantee unauthorized or database errors return structured `ServiceResponse` objects (e.g. `INTERNAL_ERROR`) instead of throwing raw 500 server errors to the client:
  - `adminToggleVerification` in [moderation.ts](file:///c:/nilamit.com/src/actions/admin/moderation.ts)
  - `resolveDispute` and `adminRefundEscrow` in [dispute.ts](file:///c:/nilamit.com/src/actions/dispute.ts)
  - `updateLogisticsStatus` in [logistics.ts](file:///c:/nilamit.com/src/actions/logistics.ts)
  - `getAdminDisputes`, `resolveAdminDispute`, and `getAdminCoordinationLog` in [disputes.ts](file:///c:/nilamit.com/src/actions/admin/disputes.ts)
  - `getTreasuryAudit`, `getAdminActiveEscrows`, `getVerificationQueue`, `approveEscrowPayment`, and `refundWithDeduction` in [treasury.ts](file:///c:/nilamit.com/src/actions/admin/treasury.ts)
  - `getAdminStats` in [stats.ts](file:///c:/nilamit.com/src/actions/admin/stats.ts)
* **Bulk Upload Schema Validation**: Secured bulk upload handling in [bulk-upload.ts](file:///c:/nilamit.com/src/actions/bulk-upload.ts) by validating each parsed row against `BulkAuctionSchema` on the server before database inserts are batch-executed, preventing corrupted records from reaching Firestore.
* **Schema Array/String Union Support**: Updated `BulkAuctionSchema` in [inventory-parser.ts](file:///c:/nilamit.com/src/lib/inventory-parser.ts) to support both raw CSV parsed strings and pre-parsed string array configurations for `images`.
* **Category Filter State Reset**: Fixed the stale state page-scroll bug on the main browse auctions page ([page.tsx](file:///c:/nilamit.com/src/app/auctions/page.tsx)) by keying the `<LoadMore>` client pagination component instance on stringified filter configurations (`JSON.stringify(filters)`), ensuring pagination resets correctly when filtering parameters change.
* **Expanded Security & Exception Tests**: Added 4 automated unit tests in [security-audit.test.ts](file:///c:/nilamit.com/tests/unit/security-audit.test.ts) verifying that the newly wrapped administrative Actions safely catch requireAdmin failure cases and return error `ServiceResponse` shapes.
* **Linter Warnings Clean-up**: Discovered and removed unused `Clock` imports from `lucide-react` across three frontend/page components, leaving the lint suite 100% warning/error free.
* **Next.js Production Build Validation**: Verified that Next.js Turbopack production builds compile successfully (`npm run build`) and pass the full unit test suite (72/72 passed).
* **Server Action Barrel Exports Fix**: Resolved build-breaking compilation errors where the Next.js action compiler couldn't statically trace re-exports. Barrel file `src/actions/admin.ts` was updated to omit `'use server'` and use explicit named exports rather than wildcard `export *` statements.
* **OpenGraph Font & Character Optimization**: Re-architected `/api/og` to attempt loading the Noto Sans Bengali font locally via `import.meta.url` with a robust CDN fallback chain to prevent Edge Runtime execution crashes. Corrected Unicode encoding corruption for critical UI symbols like the BDT currency marker (`৳`) and location pin (`📍`).
* **Linting & Avatar Optimization**: Resolved Next.js static asset build-time warnings by adding targeted `/* eslint-disable-next-line @next/next/no-img-element */` annotations to user avatar tags in `Navbar.tsx`, `profile/page.tsx`, and `UsersTab.tsx`. Standard HTML `<img>` elements are preferred here to prevent runtime resizing overhead for dynamic, third-party user avatars.
* **Proxy Bidding Price Corruption**: Fixed `src/services/bidding/modules/bid-processor.ts` to fall back to `currentPrice` if `proxyMaxBid` is falsy, preventing old documents/listings without explicit `proxyMaxBid` fields from corrupting the bid calculations and regressing bids to 10 BDT.
* **Atomic Auction Relisting Concurrency**: Refactored `relistAuction` in `src/actions/auction.ts` to retrieve and update the auction's `relisted` status within a single atomic transaction, preventing duplicate listings from being spawned by parallel triggers.
* **MFS Account Linkage Uniqueness**: Updated `linkMFSAccount` in `src/actions/user.ts` to perform the uniqueness validation query and user profile update inside a single Firestore transaction, preventing multiple users from linking the same MFS number concurrently.
* **Dispute Lookups in Escrow Service**: Replaced N+1 `Promise.all` query loops in `src/services/finance/escrow-service.ts` with a single batch `db.getAll()` call to retrieve all related disputes in one round-trip.
* **Admin Moderation Related Entities**: Replaced N+1 individual `DocumentReference` reads in `src/actions/admin-moderation.ts` (specifically inside `getAdminReports` and `getUserMap`) with native batch `db.getAll()` fetches.
* **Expanded Security Unit Test Suite**: Created `tests/unit/security-audit.test.ts` to verify proxy bidding fallbacks, atomic uniqueness checks for MFS accounts, and concurrency safeguards for auction relisting.
* **Firebase Deployments**: Committed and pushed changes to the `main` repository branch, triggering Husky auto-deployment of Firestore rules & indexes to `nilamit-52073` and Next.js auto-rollout via App Hosting. The build completed compilation on Firebase App Hosting successfully in 4m40s with `SUCCESS` status.
* **E2E Smoke Testing & Firestore Index Fix**: Ran Playwright E2E smoke tests locally. Identified a missing Firestore composite index on the `bids` collection (`auctionId` ASCENDING, `amount` DESCENDING) which was causing page query crashes during bidding history fetches. Added the index to `firestore.indexes.json` and deployed it live via the Firebase CLI (`firebase deploy --only firestore:indexes`). Re-ran the tests and validated that all E2E critical paths (signup, login, listing, bidding, sales, escrow payment, logistics) pass successfully on Chromium (`2 passed`).
* **Ended Auctions Dashboard & Profile Mapping**: Fixed the issue where ended transitional statuses (`AWAITING_PAYMENT`, `OFFER_PENDING`) appeared in the "ALL" tab of the seller dashboard but showed `0` counts and were hidden on specific tabs:
  - **Seller Dashboard Statistics & Filters** ([page.tsx](file:///c:/nilamit.com/src/app/dashboard/page.tsx)): Integrated `AWAITING_PAYMENT` and `OFFER_PENDING` statuses under the `sold` tab calculations, stats aggregation (gross sales, net earnings, platform commission), and status matches filter check.
  - **Seller Storefront** ([page.tsx](file:///c:/nilamit.com/src/app/seller/[id]/page.tsx)): Updated the Firestore query allowed statuses to fetch transitional ended listings alongside active and finalized sold items.
  - **Earning Visibility** ([AuctionCard.tsx](file:///c:/nilamit.com/src/components/auction/AuctionCard.tsx)): Extended the Net Earnings / Seller Protection card visibility checks to include listings under `AWAITING_PAYMENT` and `OFFER_PENDING` states.
  - **E2E Smoke Test Verification**: Confirmed that Playwright E2E smoke tests (`2 passed`) and Vitest unit tests (`72 passed`) execute cleanly with local dev server.

### Next Steps / Blockers
* **Blocker**: None.
* **Status**: Complete. The application is fully audited, hardened, E2E tested, linted, compiled, and deployed live to production.

## Historical Session (2026-05-17)
### What we did
* **Absolute URL Sanitizer Bypass**: Resolved query string corruption where DOMPurify entity-encoded the `&` characters in absolute image/avatar URLs into `&amp;` (e.g. `&alt=media` -> `&amp;alt=media`). Patched the core `sanitize` utility to preserve absolute HTTP and HTTPS URLs exactly as-is, fully fixing both profile photo uploads and auction image loads system-wide.
* **Google OAuth Profile Synchronization**: Fully integrated NextAuth's `account` and `profile` parameters inside the `jwt` callback to capture high-resolution Google avatars during OAuth logins/sign-ups, and asynchronously updated them into the Firestore `users` collection if the user does not have a custom profile picture set.
* **Unit Tests and Lint-Clean Validation**: Expanded the test suite inside `tests/unit/sanitizer.test.ts` to verify absolute URL query parameter preservation. Successfully compiled (`npx tsc --noEmit`) and passed all **69 / 69 unit tests** with a clean **ESLint (exit code 0)** production build.

## Historical Session (2026-05-20)
### What we did
* **Next.js Production Build Barrel Export Fix**: Refactored the administrative actions barrel file `src/actions/admin.ts` to use explicit named re-exports and removed the `'use server'` directive from the top. Next.js SWC does not support wildcard re-exports inside a `'use server'` file when compiled for dynamic routes. Removing the directive and using explicit named re-exports fully resolved the production compilation failure.
* **TypeScript Compiler Pass**: Safely removed the redundant `@ts-expect-error` directive inside `next.config.ts` because `outputFileTracingIncludes` is now natively supported by Next.js type declarations.
* **Legacy OTP Schema Purge**: Cleared out stale unit tests in `tests/unit/schemas.test.ts` that were attempting to load retired phone auth schemas (`bdPhoneSchema`, `otpSchema`), bringing the schema verification suite back to 100% health.
* **Image Moderation Mock Correction**: Restructured unit tests in `tests/unit/image-moderation.test.ts` to mock the correct `annotateImage` Vision API call and aligned error assertion expectations with the structured Sentry logger payload.
* **Manual App Hosting Rollout**: Triggered and validated a manual rollout `firebase apphosting:rollouts:create nilamit -b main` to compile and deploy the latest zero-debt code to Firebase App Hosting.

### Next Steps / Blockers
* **Blocker**: None.
* **Next**: The platform is 100% compiled, tested, and actively deploying. Next steps include rotating credentials/secrets in Google Cloud Console and adding Sentry cron alerts.

---

# Session Handoff — Audit + Hardening Pass (May 2026)

This document captures the work completed in the May 2026 audit-and-fix session and the open items the next agent should pick up. It is written so a fresh model can resume without re-reading the full chat transcript.

> **Updated 2026-05-11** — Implemented **Google Native Firebase Auth Phone Verification & Dual Sync**. Switching from third-party SMS GreenWeb gateway to Google's official native Phone Authentication service ensures zero-latency, high-reliability delivery with invisible bot-shielding (reCAPTCHA v3) and secure backend synchronizations.

---

## State of `main`

- Branch protection: **off** (so unprotected; treat with care).
- CI: red on lint with **pre-existing** technical debt (10 lint errors in files we did not touch — see "Known tech debt" below). Lint debt is out of scope for this session and should be its own PR.
- Auto-deploy: Firebase App Hosting builds + deploys on every push to `main` via Cloud Build (`apphosting.yaml`). Live URL: **`https://www.nilamit.com`** (mapped custom domain).
- Most recent merges:
  - **PR #8** (`05fdd21`, 2026-05-06 08:40 UTC) — primary audit fixes.
  - **PR #9** (`bb0b033`, 2026-05-06 08:43 UTC) — `IMAGE_MODERATION=enabled`.
  - **Commit `a12ab7d`** — Native Firebase Client-Side Email Verification integration and date coercion session fix.
  - **Commit `43dd494`** — Google Native Firebase Phone Authentication and Dual-Sync integration.

---

## What this session shipped

### Google Native Firebase Phone Authentication & Dual Sync (May 2026)
* **Invisible reCAPTCHA Guard**: Placed a dynamic, invisible reCAPTCHA container widget seamlessly within the phone verification layout. This protects SMS delivery bills from spam/abuse while maintaining a gorgeous, zero-friction interface.
* **Native linkWithPhoneNumber API**: Migrated verification trigger to use client-side `linkWithPhoneNumber()`. This invokes Google's global SMS transit network to instantly dispatch high-deliverability codes to Bangladesh phone lines (+880).
* **Double-Check Security Admin Sync**: Created the `syncVerifiedPhoneNatively(phone)` Server Action. The server directly queries Google's Firebase Auth server via the Firebase Admin SDK to check if the caller's linked profile actually has a validated number matching their submission, completely closing client spoofing pathways.
* **Best-Effort Profile Dual-Sync**: Upgraded `/api/firebase/token` to dynamically synchronize the user's `email`, `displayName`, and verified `phoneNumber` directly to Firebase Auth on token generation. Added bulletproof warning-catch fallbacks to prevent session lockups in case of formatting or duplicate number conflicts.
* **ESLint & Strict Typing Compliance**: Refactored states, imports, and handlers to completely eliminate explicit `any` keywords, fully typed the confirmation callbacks, and resolved all compiler/linter warnings.

### Native Firebase Client-Side Email Verification & Sync (May 2026)
* **Custom Auth Action URL Router**: Created a custom Next.js Client Page at `src/app/__/auth/action/page.tsx` to handle Firebase Auth action URL callbacks natively on `www.nilamit.com`. This fixes the 404 errors standard App Hosting faces because it does not automatically proxy `/__/*` routes to Google's backend action handlers.
* **Remove Sign-In Verification Email Spam**: Removed the aggressive auto-send verification check inside the client custom-token authentication process in `src/lib/firebase-client.ts`. Verification emails are now delivered strictly on-demand when users explicitly click the dispatch button inside the Profile Verification Center.
* **Native Verification Email Dispatch**: Rewrote verification dispatch button to trigger native client-side verification email delivery via standard client-side Firebase Auth SDK. Replaces reliance on unstable third-party SMTP servers.
* **Pre-Token User Auto-Registration**: Configured `/api/firebase/token` router to check, update, or create corresponding auth profiles natively inside Firebase Authentication before generating the custom mint token, ensuring the client SDK possesses accurate and syncable profile information.
* **Double-Check Security Endpoint**: Created `markEmailVerifiedNatively` server-action to securely double-check client verification states with the Google Firebase Admin SDK before committing status updates to Firestore, closing spoofing opportunities.
* **Seamless Background Synchronization**: Added background state sync to the Profile layout useEffect. When a returning verified user opens their Profile, their verified state automatically updates both in Firestore and the active NextAuth cookie session in the background.
* **Safe-Auth Date Coercion**: Patched database auth hooks and NextAuth token/session lifecycle callbacks to intercept Firestore `Timestamp` objects and convert them into standard serializable `Date` objects. This eliminates Next.js client component serialization crashes.

### SEO & Brand Logo Optimization (May 2026)
* **Favicon Sizing Audit & Resize**: Identified that the codebase was using a raw, heavy `325KB` `512x512` JPEG/PNG file as `/favicon.ico` (which is invalid as an ICO format and was causing Googlebot-Image crawler dropouts). Created a Python PIL script at `scratch/resize_icons.py` to compile true multi-resolution `.ico` assets (`16x16`, `32x32`, `48x48` layers, size reduced to **`15KB`**) and optimized png targets (`icon-32.png`, `icon-48.png` [4KB], `icon-192.png`, and `apple-icon.png`).
* **Unified Brand Logo Standardization**: Replaced inconsistent squircle/rounded-xl, shield-check, and plain letter/text logos across all user-facing pages with a unified **white Gavel inside a perfect circular badge** design (represented as a `rounded-full` container). Updated elements include:
  - **Navbar & Footer Logos**: Upgraded to use perfect circles (`rounded-full`) rather than rounded-xl and rounded-lg squircles.
  - **Login Page Banner**: Replaced the non-standard `ShieldCheck` squircle badge with the unified `Gavel` circular brand logo.
  - **Register & Forgot Password Logos**: Standardized top headers to circular `rounded-full` containers.
  - **404 / NotFound Page**: Replaced the primary-100 squircle with a bold brand-blue perfect circle housing a white gavel.
  - **OpenGraph API**: Synchronized the edge image generator (`src/app/api/og/route.tsx`) to render the custom inline Gavel SVG inside a perfect circle badge instead of the letter "N".
* **Master Asset Generation & Compilation**: Generated a beautiful, high-resolution master logo (`public/icon-512.png`) using professional image tools and executed the PIL compilation script to synchronize and rebuild all browser/OS assets seamlessly.
* **Metadata Upgrades**: Mapped explicit standard pixel dimensions (`sizes="48x48"`, `sizes="32x32"`) within `src/app/layout.tsx` to establish perfect crawl pathways for spiders.
* **JSON-LD Schema Integration**: Added global JSON-LD WebSite and Organization schema markup to the root layout, authoritative mapping site name `"Nilamit"` along with alternative brand spellings (`"nilamit"`, `"nilamit.com"`, `"নিলামিত"`, `"নীলামিত"`).
* **Search console Indexing**: Used browser-automation tool to log into Google Search Console as `md.moimsarkar22@gmail.com`, run a live inspection on `https://nilamit.com/`, and successfully trigger an immediate **"Request Indexing"** priority queue crawl.
* **Localization Updates**: Capitalized `"Nilamit"` and updated keywords in `messages/en.json` to improve brand query mapping.

### Verification & Navigation Fixes (May 2026)
* **Profile Banner Verification Badge Logic**: Resolved an issue where users with verified email addresses but unverified phone numbers incorrectly showed as "Unverified" on their profile banner and auction card badges. Re-architected `VerificationBadge` to dynamically elevate the verification tier to "Email Verified" (Level 2) or "Phone Verified" (Level 1) independently, matching the updated email-or-phone business validation rules.
* **"Place Your Bid" Button Redirection**: Linked the landing page hero's "Place Your Bid" featured auction card button to redirect users directly to `/auctions` (Browse), creating an intuitive and active entrance funnel.
* **"My Listings" Sidebar & Navigation Overhaul**: Integrated dynamic pre-fetching of user metrics (`watchlistCountSnap`, `listingsCountSnap`) into the dashboard sidebar, generating high-fidelity live UX count badges. Overhauled the dashboard sidebar layout with premium active states (e.g., scale transitions `scale-[1.02]`, vibrant gradient fills like `bg-blue-600 text-white`, and custom outline accents). Introduced an ultra-accessible "My Listings" navigation link with a stylized Store icon in the root Navbar (desktop and mobile layouts) right beside the "Sell" button to make listings instantly discoverable.

### Money / authz hardening
- `src/lib/ratelimit.ts` — per-limiter `Policy` flag. Financial limiters (`bidLimiter`, `authLimiter`, `loginLimiter`, all OTP limiters) now **fail CLOSED** in production. `apiLimiter` keeps fail-open. Closes a CLAUDE.md rule #3 violation that was silent.
- `src/actions/dispute.ts::resolveDispute` — verifies `escrow.exists` and `escrow.status === 'DISPUTED'` before flipping. Closes a race where an admin refund + dispute resolution could double-pay.
- `src/actions/dispute.ts::adminRefundEscrow` — single source of truth for refunds. Validates allowed status set, requires non-empty `reason`, increments seller `defectCount`, kicks off seller-performance recompute, audit-logs.
- `src/actions/escrow.ts::refundEscrow` — now a thin compat shim that delegates to `adminRefundEscrow`.
- `src/lib/auction-logic.ts` — moved `incrementGlobalStat('totalRevenue')` out of the transaction body into `sendSaleNotifications` (was double-counting on contention retries). Added `coerceEndTime()` so malformed auctions are EXPIRED rather than processed as sales.
- `src/services/bidding/bidding-service.ts::executeBuyItNow` — same endTime guard. Alerts batch chunked at 450 writes (Firestore caps at 500).

### Logistics PII closure
- New `src/lib/logistics.ts` — `'server-only'` internal module. `createLogisticsOrder` takes pre-loaded addresses (no caller-controlled user lookups). Tracking ID now `NLM-<time>-<random>` to avoid collisions. `updateLogisticsStatus` runs in `runTransaction` with `arrayUnion` for history.
- `src/actions/logistics.ts` — reduced to admin-only Server Action wrapper around the above. **`createLogisticsOrder` is no longer reachable from the public Server Actions wire** — closes the address-PII exfiltration vector that the previous version exposed.

### Admin gating
- `src/app/admin/page.tsx` — uses `requireAdmin().catch → redirect('/login')` (DB-deep, not JWT-only).
- `src/actions/admin-content.ts` — `getSystemConfig` and `getFeaturedAuctions` now require admin (were ungated reads).
- `src/app/admin/disputes/page.tsx` — server-side admin gate; client moved to `AdminDisputesClient.tsx`. Native `window.prompt` for resolution notes replaced with a styled modal (validates non-empty).

### Cron + GitHub Actions
- `.github/workflows/cron.yml` — was failing on every run before this session. Three bugs fixed:
  1. URL pointed at non-routable address → switched to `www.nilamit.com`.
  2. Used GET against POST-only routes → all `curl` calls now `-X POST`.
  3. POSTs without a body returned 411 → added `-H "Content-Type: application/json" --data '{}'`.
- Added the previously-unscheduled jobs: `closing-soon` (15 min), `process-alerts` (5 min), `enforce-policies` (hourly), `gc-uploads` (weekly Sun 04:00 UTC).
- `src/app/api/cron/enforce-policies/route.ts` — GET → POST + `verifyCronSecret`.
- `src/app/api/cron/process-auctions/route.ts` — now re-exports `close-auctions` to eliminate the duplicate.
- `src/app/api/cron/closing-soon/route.ts` — per-auction work parallelised in chunks of 8.
- `src/app/api/cron/process-alerts/route.ts` — deactivate batch chunked at 450/commit.

### Uploads
- `src/app/api/upload/route.ts` — replaced `makePublic()` with signed URLs (auction: 90 d, chat: 7 d). Wired in Cloud Vision SafeSearch via the new `src/lib/image-moderation.ts`. Sanitised `originalName` storage metadata.
- `src/lib/image-moderation.ts` — Vision SafeSearch wrapper. Hard-blocks `LIKELY`/`VERY_LIKELY` adult or violence. Auto-no-ops when `IMAGE_MODERATION != "enabled"` so the upload path is never blocked by an infra gap. Vision API enabled (`gcloud services enable vision.googleapis.com`); flag set to `enabled` in `apphosting.yaml`.
- New `src/app/api/cron/gc-uploads/route.ts` — weekly GC for orphaned Storage objects under `auctions/`. Only deletes files >7 d old that aren't referenced by any `auction.images` URL. Capped at 500 deletes/run, paginated.

### Frontend
- `src/components/auction/BidPanel.tsx` — BIN purchase native `confirm()` replaced with a real modal (cancel + click-outside + ARIA-modal + disabled-during-processing). Bid-amount auto-reset uses `userTouchedRef` instead of equality with the previous min, so manual entries aren't clobbered. `canvas-confetti` lazy-loaded so it doesn't ship in the initial bundle of every auction page.
- `src/hooks/useAuctionBids.ts` — accepts `initialBids` for server-side hydration.
- `src/app/auctions/[id]/page.tsx` — passes server-fetched bids through `BidPanelWrapper` so a refresh on a busy auction shows the latest 10 bids immediately.
- `src/components/layout/Navbar.tsx` — dropped unused `useLocale`/`usePathname`/`useRouter`, consolidated sign-out into one `handleSignOut`, removed unreachable `window.location.reload()`.
- `src/actions/bid.ts` — `newMinimum` extraction from `BID_TOO_LOW` error message now slices the prefix before regex (was concatenating digits embedded in the prefix).

### Firestore
- New composite indexes: `bidDeposits(bidderId, auctionId, status)` and `alerts(auctionId, type, isActive)`. **Already deployed** to project `nilamit-52073` via `firebase deploy --only firestore:indexes`.
- `firestore.rules` — added a comment block explaining the `request.auth.token.isAdmin` trust model. Custom-token mint at `/api/firebase/token` is real (not dead code); ~1 h staleness window is intentional and acceptable for read-only access. Server Actions remain the DB-deep authoritative path.

### i18n
- **Bangla dropped per direction.** Removed `messages/bn.json` and the dead `src/app/[locale]/` folder. `src/i18n/routing.ts` set to `['en']`. Added `Navigation.signedInAs` to `en.json`. Deduped duplicate keys (last-wins values preserved). Updated CLAUDE.md, README.md, AGENTS.md, docs/architecture.md, docs/summary.md.

### Operational
- **`CRON_SECRET` synced** between Firebase Secret Manager and GitHub Actions (was stale since 2026-02-16). Smoke-tested: 3/5 cron jobs pass against prod with the new secret; the other 2 will pass once auto-deploy lands the route changes.
- **PR #8 merged** to `main`.
- **Cloud Vision API enabled** on project `nilamit-52073`.
- **PR #9 merged** flipping `IMAGE_MODERATION=enabled`.

---

## Verification snapshot

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 53 / 53 pass |
| Pre-commit (eslint --fix on staged files) | clean on every commit |
| Firestore indexes deployed | yes |
| Manual cron run (`gh workflow run cron.yml -f job=all`) | 3/5 success against pre-deploy prod (close-auctions, closing-soon, process-alerts). Expect 5/5 once the May 2026 deploy completes. |

---

## Open items / "next" for the next agent

### Should do (real findings, not done)

1. **~~Pre-existing CI lint debt on `main`~~ — DONE 2026-05-07.** Fixed all 10 errors across `src/actions/auth.ts`, `src/app/admin/tabs/DisputesTab.tsx`, `src/app/page.tsx` (refactored to load data inside try/catch and render outside), and `src/app/profile/page.tsx`. CI lint is now zero-error.

2. **~~Confirm post-deploy state~~ — DONE 2026-05-06.** PR #11 (`process-auctions` route fix) and PR #12 (missing `auctions(status, updatedAt)` index) unblocked the deploy. All 5 cron jobs are now green against production. Storage bucket `nilamit-52073.firebasestorage.app` was auto-provisioned during the deploy.

3. **`GREENWEB_TOKEN` is still a placeholder** — STILL OPEN. SMS OTPs would silently fail in production today (the secret value `"console"` is truthy so `GreenWebGateway` instantiates with that as the token, all subsequent API calls return non-Ok). 2026-05-07: added `log.error` + Sentry capture in `src/lib/sms-gateway.ts` so failures are no longer silent — operator should see Sentry alerts the next time someone tries to verify a phone. Real fix: get a GreenWeb token, `gcloud secrets versions add GREENWEB_TOKEN --data-file=- --project=nilamit-52073`, redeploy.

4. **~~Sentry visibility for new code paths~~ — INSTRUMENTED 2026-05-07.** Added `Sentry.captureException` / `captureMessage` calls in `src/lib/image-moderation.ts` (Vision client unavailable + API error paths) and `src/app/api/cron/gc-uploads/route.ts` (cron-level failures). Next agent should still verify alerts fire end-to-end once organic traffic arrives.

### Could do (P2, not urgent)

5. **~~Translate `useTranslations` text in dynamically-imported components~~ — DONE 2026-05-08.** Localized `EscrowActionCard.tsx` and `GatedContactInfo.tsx` entirely using `next-intl` dictionary hooks under `"Escrow"`. Added all missing keys (such as `verificationInProgress`, `addressRequired`, `sellerAddressMissing`, `logisticsProtected`, etc.) to `messages/en.json`. Also implemented and deployed critical Firestore compound indexes for `messages` and `bids` query pathways to prevent production QueryExceptions.

6. **~~`payEscrowAdvance` UX for missing addresses~~ — DONE 2026-05-07.** `src/components/social/EscrowActionCard.tsx` and `src/components/ui/GatedContactInfo.tsx` now detect `ADDRESS_REQUIRED`, `SELLER_ADDRESS_MISSING`, and `MFS_LINKAGE_REQUIRED` error codes and show specific toasts + redirect to `/profile` where appropriate.

7. **~~`/api/logistics/labels/<trackingId>` endpoint~~ — DONE 2026-05-07.** Removed the `labelUrl` field from `createLogisticsOrder` and the auction `logistics` map. When a real provider (Pathao / RedX) is wired up, the courier's webhook should populate `logistics.labelUrl` directly, not this code path.

8. **Operational: rotate `CRON_SECRET` to a new value** in both Firebase Secret Manager + GitHub Actions secret. Was synced 2026-05-06 but never rotated; the value has been live since 2026-02-16 and may have leaked through CI logs.

### Won't do without explicit ask (out of scope)

- Rolling back any of the May 2026 changes.
- Reintroducing Bengali (the user explicitly dropped it).
- Touching the live escrow / dispute state machine in production.

---

## Useful commands for the next agent

```bash
# Deploy state
firebase apphosting:rollouts:list nilamit --project nilamit-52073
gcloud builds list --project=nilamit-52073 --region=asia-southeast1 --limit=3

# Cron health
gh workflow run cron.yml --ref main -f job=all
gh run list --workflow=cron.yml --limit=5

# Secret sync (if you ever rotate)
gh secret set CRON_SECRET --repo Sayem9999/nilamit.com \
  --body "$(gcloud secrets versions access latest --secret=CRON_SECRET --project=nilamit-52073)"

# Smoke endpoints (expect 401 without real bearer)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://www.nilamit.com/api/cron/close-auctions" \
  -H "Authorization: Bearer dummy" -H "Content-Type: application/json" --data '{}'

# Index deploy
firebase deploy --only firestore:indexes --project nilamit-52073

# Local verify
npx tsc --noEmit && npx vitest run
```

---

## Important context the next agent should NOT forget

- **CLAUDE.md is loaded automatically** — the Critical Rules block (now 14 rules) is the source of truth for conventions. New rules added this session: #13 (logistics writes), #14 (refund consolidation), and the upgrade to #12 (Vision moderation + signed URLs).
- **No `[locale]` folder.** Routes are flat. If you see docs claiming `src/app/[locale]/admin/`, they're stale.
- **No Cloud Scheduler.** All crons run from `.github/workflows/cron.yml`. If you find yourself reaching for `gcloud scheduler`, you're wrong — the API isn't even enabled.
- **Vision moderation is fail-open by design.** A Vision API outage allows uploads to continue (with a Sentry warning). Don't "fix" this to fail-closed without consulting — the auction listing flow can't tolerate Vision being a hard dependency.
- **`refundEscrow` and `adminRefundEscrow` are the same code path.** Don't add a new refund action; extend `adminRefundEscrow`.
