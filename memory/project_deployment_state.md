---
name: Deployment state — nilamit-52073
description: Current live deployment status, what's working, what needs attention
type: project
---

Platform is LIVE at https://nilamit--nilamit-52073.asia-southeast1.hosted.app

**Project:** nilamit-52073 | **Region:** asia-southeast1 | **Admin:** sayemf21@gmail.com

**Why:** Full build + deployment completed April 29 2026. 9 sequential build errors resolved.

**How to apply:** Use this as baseline when diagnosing any new deployment issues.

## Working
- /api/health → { status: ok, db: ok }
- Homepage, auction browsing, bidding
- Dashboard (watchlist, bids, escrow, listings, coordination)
- Admin panel at /en/admin (requires login as sayemf21@gmail.com)
- Firestore rules + indexes deployed
- All 16 secrets stored in Secret Manager with correct IAM grants

## Needs attention
- GOOGLE_CLIENT_SECRET must be rotated (old value in .env was potentially leaked)
- GREENWEB_TOKEN is placeholder "console" — OTPs log to stdout, not SMS
- package-lock.json has manual @emnapi patches that npm install overwrites
- Auth.js v5 beta — upgrade when stable

## Key deployment facts
- Firebase App Hosting builds with NODE_ENV=production → devDeps omitted
- Build-time CSS packages (tailwindcss, @tailwindcss/postcss, tw-animate-css, shadcn) in dependencies
- prepare script: "husky || true" — avoids CI failure when devDeps absent
- cloudbuild.yaml uses npm install (not npm ci) for initial step
- Buildpack internally runs npm ci — lockfile must be Linux-compatible
