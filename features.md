# 🚀 Nilamit Platform Features

Nilamit is a high-performance, real-time C2C auction marketplace designed for trust, speed, and visual excellence.

## 1. Core Auction Engine
- **Real-time Bidding**: Powered by Pusher for sub-second updates across all participants.
- **Serializable Transactions**: High-concurrency Postgres locking prevents race conditions and ensures "Double-Bid" protection.
- **Anti-Snipe (Soft Close)**: Auctions ending within 2 minutes are automatically extended by 2 minutes when a new bid is placed, ensuring a fair "Hammer Price."
- **Asset Management**: Integrated with UploadThing for high-resolution gallery uploads.

## 2. Social Proof & Persuasion (Trust 2.0)
- **Verified Seller Badge**: Admin-vetted sellers receive a blue shield badge on cards and profiles.
- **User Progression (Levels)**: Dynamic experience levels based on platform activity.
- **Winning Streaks**: Visible fire icons for users who have won multiple auctions recently.
- **Live Activity Ticker**: A global "Pulse" showcasings real-time bid activity across the marketplace.

## 3. Trust & Safety Layer
- **Reputation Scores**: Algorithmically calculated scores based on reviews and transaction history.
- **Phone Verification Loop**: Compulsory verification for high-intent actions (creating auctions/large bids).
- **Bid Deposits**: (Optional) Held deposits for high-stakes items to prevent bad-faith bidding.
- **User Reporting**: Community-driven moderation for suspicious listings.

## 4. Discovery & Personalization
- **Smart Search**: Hybrid keyword + semantic ranking for relevant results.
- **Personalized Watchlists**: Real-time tracking of desired items.
- **Category Feeds**: "For You" and "Ending Soon" feeds tailored to user interests.
- **Smart Hub**: Centralized "Notification Hub" for outbid alerts and auction updates.

## 5. Admin Command Center
- **Dynamic Content Control**: Real-time updates to Hero titles, subtitles, and global announcements.
- **Featured Management**: Single-click toggles to promote high-value auctions to the homepage.
- **User Moderation**: Direct dashboard for granting/revoking Verified Seller status.
- **Health Metrics**: Real-time monitoring of total users, bids, and revenue streams.

## 6. Real-time Alerts
- **Outbid Alerts**: In-app toast + Browser notification fires the moment a user is outbid.
- **Ending Soon Alerts**: Proactive notifications pushed 30-60 minutes before a watched item closes.
