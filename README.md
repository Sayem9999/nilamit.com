# 🏛️ nilamit.app

> Bangladesh's Trusted C2C Auction & Bidding Marketplace

নিলাম (Nilam) means "auction" in Bengali. nilamit.app is a mobile-first, trust-focused C2C marketplace where Bangladeshi users can buy and sell through transparent, real-time bidding.

## Tech Stack

| Layer         | Technology                                 |
| ------------- | ------------------------------------------ |
| **Framework** | Next.js 15+ (App Router, Server Actions)   |
| **Database**  | PostgreSQL via Supabase                    |
| **ORM**       | Prisma 6                                   |
| **Real-time** | Pusher (WebSocket Interaction)             |
| **Auth**      | Auth.js v5 (Google + Credentials)          |
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

## Key Features

- **Anti-Sniping (Soft Close)**: Bids in the last 2 minutes extend the auction by 2 minutes
- **Concurrency Safety**: PostgreSQL `SELECT FOR UPDATE` row locking prevents bid race conditions
- **Phone Trust Anchor**: +880 phone verification required before bidding/selling
- **Admin Panel**: User management, auction moderation, platform stats
- **Reputation System**: Score-based trust built through successful transactions

## Environment Variables

See `.env.example` for all required configuration.

## Documentation

- [CONSTITUTION.md](./CONSTITUTION.md) — Non-negotiable architectural principles
- [MEMORY.md](./MEMORY.md) — Key decisions and gotchas
- [STYLE_GUIDE.md](./STYLE_GUIDE.md) — Design system and code conventions

## License

Private — © 2026 nilamit.app
