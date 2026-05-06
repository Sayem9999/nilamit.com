---
name: Deployment state — nilamit-52073
description: Current live deployment status, what's working, what needs attention
type: project
---

Platform is LIVE at https://nilamit--nilamit-52073.asia-southeast1.hosted.app

**Project:** nilamit-52073 | **Region:** asia-southeast1 | **Admin:** sayemf21@gmail.com

**Why:** Full stabilization and Auth Hardening completed May 4, 2026. Resolved critical 403 Forbidden errors and internal URL redirect mismatches in Firebase App Hosting.

**How to apply:** Use this as baseline when diagnosing any new deployment issues.

## Working
- /api/health → { status: ok, db: ok }
- Homepage (RESTORED): Real self-healing dynamic database stats (users, sellers, listings, bids) with firestore .count().get() aggregations.
- Authentication: Email/Google Login working with linked account support.
- Rate Limiting: Premium sliding-window protection live using Upstash Redis configured via GCP secrets. Backed by try-catch fail-open and Firestore attempt counting.
- Phone & Email Verification: Safe-fails open without Redis. Hardened OTP brute-force security enforcing a 5-attempt threshold directly in Firestore transactions.
- Product/Auction Uploads: Stable server-side image processing utilizing Firebase Admin Storage, completely immune to client-side auth configuration limitations.
- Media Rendering: Localized bKash and Nagad vector SVG paths in `/public`, completely bypassing CSP blockades and browser hotlink failures.
- Dashboard (watchlist, bids, escrow, listings, coordination)
- Admin panel at /admin (requires login as sayemf21@gmail.com)
- Firestore rules + indexes deployed
- All 19 secrets stored in Secret Manager with correct IAM grants (including new UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).

## Needs attention
- GREENWEB_TOKEN is placeholder "console" — OTPs log to stdout, not SMS
- package-lock.json has manual @emnapi patches that npm install overwrites
- Auth.js v5 beta — upgrade when stable

## Key deployment facts
- Firebase App Hosting builds with NODE_ENV=production → devDeps omitted
- Build-time CSS packages (tailwindcss, @tailwindcss/postcss, tw-animate-css, shadcn) in dependencies
- prepare script: "husky || true" — avoids CI failure when devDeps absent
- cloudbuild.yaml uses npm install (not npm ci) for initial step
- Buildpack internally runs npm ci — lockfile must be Linux-compatible
