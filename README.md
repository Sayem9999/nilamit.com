# nilamit.app

> Bangladesh's Trusted C2C Auction & Bidding Marketplace

নিলাম (*Nilam*) means "auction" in Bengali. nilamit.app is a mobile-first, trust-focused C2C marketplace where Bangladeshi users buy and sell through transparent, real-time bidding secured by phone verification and escrow.

---

### 🚀 Status: Production Ready (v2.0 - Final)
**Completion: 100%** — All Core, Security, Scalability, and Elite features (Gamification, Automation, Enforcement) are finalized.

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
| Monitoring | Sentry (errors + performance) |
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
├── actions/        # Server Actions — auth gate, validation, revalidation
├── services/       # Domain logic — BiddingService, AuctionService
├── app/            # App Router — pages, API routes, cron endpoints
│   ├── [locale]/   # i18n-wrapped pages (en/bn)
│   └── api/        # REST endpoints (upload, cron, health, firebase token)
├── components/     # React components — domain-driven, memoized
├── lib/            # Infrastructure — auth, db, rate-limiting, sanitization
├── hooks/          # Custom hooks — useAuctionBids, useSound
├── context/        # React context — SettingsContext
└── types/          # Shared TypeScript types
```

---

## Key Features

- **Real-time bidding** — Firestore transactions with anti-sniping (2-minute soft close on last-second bids)
- **Phone verification gate** — All bidding and listing requires verified Bangladesh mobile number (+88)
- **Escrow system** — PENDING → HELD → RELEASED → REFUNDED lifecycle with dispute resolution
- **Buy It Now** — Atomic instant purchase at seller-set price
- **Admin dashboard** — Moderation, user management, treasury audit, dispute resolution
- **Gamification** — Badges, winning streaks, user levels, leaderboard
- **Real-time chat** — Buyer/seller coordination unlocked by escrow payment
- **Price alerts** — OUTBID, TARGET_REACHED, ENDING_SOON notifications
- **Bulk upload** — CSV-driven mass auction creation for power sellers
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

Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SENTRY_DSN`, `RESEND_API_KEY`, `GREENWEB_TOKEN`

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
