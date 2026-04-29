# 🏛️ nilamit.app

> Last Updated: April 29, 2026

> Bangladesh's Trusted C2C Auction & Bidding Marketplace

নিলাম (Nilam) means "auction" in Bengali. nilamit.app is a mobile-first, trust-focused C2C marketplace where Bangladeshi users can buy and sell through transparent, real-time bidding.

## Tech Stack (Firebase Native)

| Layer         | Technology                                 |
| ------------- | ------------------------------------------ |
| **Framework** | Next.js 15+ (App Router, Server Actions)   |
| **Database**  | Firebase Firestore (NoSQL)                 |
| **Real-time** | Firebase Realtime Database (RTDB)          |
| **Storage**   | Firebase Storage (Images & Documents)      |
| **Auth**      | Auth.js v5 (Hybrid Phone/Email/Google)     |
| **Verification** | SMS OTP + Multi-Step Verification Gate    |
| **i18n**      | next-intl (English & Bengali Support)      |
| **Styling**   | Tailwind CSS 4 + Lucide Icons              |
| **SMS**       | Pluggable (GreenWeb / BulksmsBD / Console) |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env.local
# Edit .env.local with your Firebase credentials and auth secrets

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

src/
├── actions/          # Thin Controllers (Auth validation, revalidation)
├── services/         # Core Business Logic (DB transactions, side effects)
├── app/              # Routing & SEO (App Router, [locale])
├── components/       # Domain-driven UI (Sharded & Memoized)
├── lib/              # Infrastructure (Firebase, Auth, Sanitization)
└── types/            # Shared TypeScript types
```

## 💎 Key Features (**v2.0.0: Enterprise Scale**)
- **SOA Architecture**: Decoupled service layer for high testability and platform reuse.
- **Hardened Security**: Edge-level rate limiting, XSS sanitization, and Zero-Trust Firestore rules.
- **Performance Optimized**: Parallelized data fetching and component-level sharding for low TTI.
- **Real-time Bidding**: Firestore-native transactions with anti-sniping (soft-close) logic.
- **Integrated Trust**: Phone-verification gates and automated reputation scoring.

## Environment Variables

See `.env.example` for all required configuration.

## License

Private — © 2026 nilamit.app
