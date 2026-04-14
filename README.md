# 🏛️ nilamit.app

> Bangladesh's Trusted C2C Auction & Bidding Marketplace

নিলাম (Nilam) means "auction" in Bengali. nilamit.app is a mobile-first, trust-focused C2C marketplace where Bangladeshi users can buy and sell through transparent, real-time bidding.

## Tech Stack

| Layer         | Technology                                 |
| ------------- | ------------------------------------------ |
| **Framework** | Next.js 15+ (App Router, Server Actions)   |
| **Database**  | PostgreSQL via Supabase                    |
| **ORM**       | Prisma 7                                   |
| **Real-time** | Pusher (WebSocket Interaction)             |
| **Auth**      | Auth.js v5 (Hybrid Phone/Email/Google)     |
| **Verification** | SMS OTP + Multi-Step Verification Gate    |
| **i18n**      | next-intl (English & Bengali Support)      |
| **Styling**   | Tailwind CSS 4 + shadcn/ui                 |
| **SMS**       | Pluggable (GreenWeb / BulksmsBD / Console) |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env.local
# Edit .env.local with your Supabase DATABASE_URL and auth secrets

# 3. Run database migrations
npx prisma migrate dev

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── actions/          # Server Actions (bid, auction, escrow, chat)
├── app/
│   ├── [locale]/     # Internationalized routes (bn/en)
│   │   ├── admin/    # Admin panel
│   │   ├── auctions/ # Listing, detail, create
│   │   └── dashboard/# User persona dashboards
├── components/
│   ├── auction/      # BidPanel, Countdown, Alerts
│   └── social/       # Chat, Escrow Cards, Leaderboards
├── lib/              # Logic, DB, Pusher, PII-Filter
└── types/            # Shared TypeScript types
```

## 💎 Key Features (**v1.7.0: Trust & Coordination**)
- **StarMap Constellation**: Interactive D3.js visualization of the marketplace "Social Fabric," mapping trust through link physics (Sale vs Interest).
- **Escrow Coordination Hub**: A transaction-gated logistics layer with real-time chat and PII shielding, unlocked only after an advance is held.
- **Admin Dispute Resolution**: Centralized conflict management with atomic database transactions for fund release and reputation adjustment.
- **One-Time Soft-Close**: Automatically extends auctions by 2 minutes on late bids to ensure fair price discovery.
- **Elite Leaderboards**: Reputation-based stratification for verified buyers and sellers.

## Environment Variables

See `.env.example` for all required configuration.

## Documentation

- [CONSTITUTION.md](./CONSTITUTION.md) — Non-negotiable architectural principles
- [MEMORY.md](./MEMORY.md) — Key decisions and gotchas
- [STYLE_GUIDE.md](./STYLE_GUIDE.md) — Design system and code conventions

## License

Private — © 2026 nilamit.app
