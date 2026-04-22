# 🏛️ nilamit.app

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

## Project Structure

```
src/
├── actions/          # Server Actions (bid, auction, escrow, moderation)
├── app/
│   ├── [locale]/     # Internationalized routes (bn/en)
│   │   ├── admin/    # Admin panel (Users, Moderation, Disputes)
│   │   ├── auctions/ # Listing, detail, create
│   │   └── dashboard/# User persona dashboards
├── components/
│   ├── auction/      # BidPanel, Countdown, Real-time Price
│   └── upload/       # Firebase-native Image Upload
├── lib/              # Logic, Firebase (Admin/Client), i18n
└── types/            # Shared TypeScript types
```

## 💎 Key Features (**v1.5.0: Hardened Security**)
- **Firebase-Native Architecture**: Fully serverless stack using Firestore and RTDB for zero-latency bidding.
- **Automated Platform Escrow**: Secure payment gateway integration with real-time status tracking.
- **Moderation Engine**: Built-in banning system with middleware-level enforcement.
- **Coordination Hub**: Post-auction logistics layer with PII shielding and integrated chat.
- **Admin Audit Trail**: High-fidelity dashboard for user management and dispute resolution.

## Environment Variables

See `.env.example` for all required configuration.

## License

Private — © 2026 nilamit.app
