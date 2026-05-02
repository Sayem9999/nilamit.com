# nilamit.app

> Bangladesh's Trusted C2C Auction & Bidding Marketplace

নিলাম (*Nilam*) means "auction" in Bengali. nilamit.app is a mobile-first, trust-focused C2C marketplace where Bangladeshi users buy and sell through transparent, real-time bidding secured by phone verification and escrow.

---

### 🚀 Status: Production Ready (v2.2 - Logistics & Infrastructure Stabilization)
**Completion: 100%** — All Core, Security, Scalability, and Professional Retailer features (Bifurcated Registration, Zero-Loss Logistics, eBay-style Trust) are finalized and production-hardened.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router, Server Actions, standalone output |
| Database | Firebase Firestore (all writes via Admin SDK — zero client writes) |
| Real-time | Firebase Realtime Database (RTDB) — bids, presence, notifications |
| Storage | Firebase Storage — auction images, chat attachments |
| Auth | Auth.js v5 — Email/Password + Phone OTP + Google OAuth |
| Rate Limiting | Upstash Redis (fail-closed in production) |
| Monitoring | Sentry (errors + performance + session replay) |
| i18n | next-intl — English and Bengali |
| Styling | Tailwind CSS 4 + shadcn/ui + Framer Motion |
| SMS | Pluggable — GreenWeb (production) or Console (dev) |
| Deployment | Firebase App Hosting (git-triggered, Cloud Run backend) |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment config
cp .env.example .env.local
# Edit .env.local — see Environment Variables section below

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── actions/        # API entry points (Server Actions) — auth gate, validation, revalidation
│   ├── admin/      # Modular administrative actions (Stats, Disputes, Treasury, etc.)
├── services/       # Pure business logic — AdminService, BiddingService, AuctionService
├── app/            # App Router — pages, API routes, cron endpoints
│   ├── [locale]/   # i18n-wrapped pages (en/bn)
│   └── api/        # REST endpoints (upload, cron, health, firebase token)
├── components/     # React components — domain-driven, memoized, lazy-loaded
├── lib/            # Infrastructure — auth, db, ratelimit, logger, sanitization
├── types/          # Domain-driven modular type system (enums, user, auction, finance, etc.)
├── hooks/          # Custom hooks — useAuctionBids, useSound
└── context/        # React context — SettingsContext
```

---

## Architecture & Scalability

Nilamit v2.0 implements a **Service-Layer Architecture** to ensure long-term maintainability:
- **Modular Server Actions**: Large action files are split into domain-specific modules with barrel-export patterns.
- **Pure Service Layer**: Complex business logic is decoupled from the UI layer into dedicated services, facilitating easier unit testing and reuse in background jobs.
- **Domain-Driven Types**: A structured type system replaces monolithic type definitions, reducing circular dependencies and improving build performance.
- **Production-Grade Observability**: Integrated structured logging with Sentry integration and performance tracing across critical bidding paths.

---

## Key Features

- **Real-time bidding** — Firestore transactions with anti-sniping and **Proxy Bidding** (Automatic Max Bids)
- **Bifurcated Registration** — Separate entry paths for **Personal** and **Business (Retailer)** accounts with distinct UI themes
- **eBay-style Trust** — **"Top Rated"** gold shields and **"Business Retailer"** badges based on sales volume and defect rates (≤5%)
- **Phone verification gate** — All bidding and listing requires verified Bangladesh mobile number (+88)
- **Escrow system** — PENDING → HELD → RELEASED → REFUNDED lifecycle with dispute resolution
- **Buy It Now** — Atomic instant purchase at seller-set price
- **Admin dashboard** — Moderation, user management, treasury audit, and **Professional Logistics** auditing
- **Gamification** — Badges, winning streaks, user levels, leaderboard
- **Real-time chat** — Buyer/seller coordination unlocked by escrow payment
- **Price alerts** — OUTBID, TARGET_REACHED, ENDING_SOON notifications
- **Zero-Loss Logistics** — Formalized 120 BDT RTO deduction for frivolous rejections to protect sellers from courier losses
- **Bulk upload** — CSV-driven mass auction creation for **Verified Retailers**
- **Second Chance Offer** — Sellers can offer items to underbidders on closed auctions
- **i18n** — Full English and Bengali support
- **PII filtering** — Phone numbers and emails stripped from public listings automatically

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values. Required variables:

| Variable | Description |
|---|---|
| `AUTH_SECRET` | JWT signing secret — generate with `openssl rand -base64 32` |
| `ADMIN_EMAILS` | Comma-separated admin email list |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID (client) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `CRON_SECRET` | Secret for authenticating cron job requests |

| `SENTRY_DSN` | Sentry Data Source Name |
| `SENTRY_AUTH_TOKEN` | Sentry authentication token (for source map uploads) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (optional) |
| `RESEND_API_KEY` | Resend API key for emails (optional) |
| `GREENWEB_TOKEN` | GreenWeb SMS API token (optional) |

---

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx vitest run       # Unit tests
npx playwright test  # E2E tests
```

---

## Deployment

Deployment is handled by **Firebase App Hosting** — push to `main` triggers an automatic Cloud Build and deploy. See [docs/DEPLOY_FIREBASE.md](docs/DEPLOY_FIREBASE.md) for full setup instructions.

---

## Security
- Rate limiting on all auth, bid, OTP, and upload endpoints via Upstash Redis (fail-closed in production)
- **Authorized PII Gating** — Sensitive data (seller phone) is only revealed to the auction winner or the seller themselves; others see sanitized profiles
- **Magic-Byte Image Validation** — Uploads are validated against actual file bytes (JPEG, PNG, WebP, GIF) to prevent script-in-image attacks
- OTP generation uses `crypto.randomInt()` — cryptographically secure
- Verification tokens stored as SHA-256 hashes
- Content Security Policy, HSTS, X-Frame-Options, and other security headers enforced at the middleware level
- Banned users blocked at middleware level within 5 minutes of admin action

See [docs/SECURITY.md](docs/SECURITY.md) for the full security architecture.

---

## License

Private — © 2026 nilamit.app
