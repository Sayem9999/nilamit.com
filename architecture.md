# Nilamit Architecture: The Global Blueprint

This document outlines the architectural layers and core technologies powering **Nilamit**, a mission-critical C2C auction marketplace.

## 🏛️ System Overview

Nilamit is built on a **Stateless, Layered Architecture** using the Next.js 15 App Router. The primary goal is to ensure high concurrency for bidding wars while maintaining strict data integrity for financial transactions.

```mermaid
graph TD
graph TD
    User((User)) -->|Browser| FE[Frontend Layer: Next.js 15]
    FE -->|Server Actions| BL[Business Logic Layer: Server Actions]
    BL -->|Reputation/Gating| TC[Trust & Coordination Engine]
    TC -->|Row Locking| DB[(Data Layer: PostgreSQL/Prisma)]
    TC -->|Real-time| PS[Real-time Bus: Pusher]
    BL -->|Infrastructure| INF[Infra Stack]
    
    subgraph INF
        R[Resend: Email]
        U[Uploadthing: Media]
        S[SMS Gateway: Verification]
    end
    
    PS -->|WebSocket| FE
```

---

## 🎨 Layer 1: Frontend (Next.js 15)
- **Framework**: React 19 + Next.js App Router.
- **Styling**: Tailwind CSS with a "Premium Dark/Light" design system.
- **Componentry**: Modular `shadcn/ui` components for consistency.
- **Internationalization**: `next-intl` using a `[locale]`-based dynamic routing strategy (English and Bengali).
- **Client State**: Integrated hooks (`useAuctionBids`, `useSound`) and React Context for settings.

## ⚙️ Layer 2: Application (Server Actions)
- **Stateless Logic**: All business logic resides in `src/actions`, ensuring the backend can scale horizontally.
- **Validation**: Strict schema validation using **Zod**.
- **Concurrency Control**: 
  - **Bidding**: Uses `SERIALIZABLE` transaction isolation and `SELECT FOR UPDATE` row-level locking to prevent race conditions during the final seconds of an auction.
  - **Auction Closing**: Decentralized closing logic (triggered by users or system) to ensure reliability at scale.

## 🗄️ Layer 3: Data (Prisma & PostgreSQL)
- **ORM**: Prisma for type-safe database interactions.
- **Schema Management**: Hierarchical models for Auctions, Bids, Users, and Escrow.
- **Optimization**: Strategic indexes on `status`, `endTime`, `auctionId`, and `bidderId` for sub-100ms query performance.

---

## 🚀 Integrated Infrastructure Stack

### 1. Real-time Engine (Pusher)
- Handles the "Pulse" of the platform.
- **Presence Channels**: Track active viewers on an auction.
- **Public Channels**: Broadcast new bids to all browsers.
- **Private Channels**: Deliver sensitive `outbid-alert` and `price-alert` messages to individual users.

### 2. Media Layer (Uploadthing)
- Handles serverless image uploads for auction listings and coordination chat attachments.
- Secure processing with callback hooks to update DB references.

### 3. Identity & Trust (Auth.js)
- **NextAuth.js v5**: Handles Google OAuth and Email/Password credentials.
- **Trust-Tier System**: JWT augmentation with Reputation Score, User Level, and Winning Streak.
- **Persona Routing**: Dynamic dashboards adapted for `BUYER`, `SELLER`, and `ADMIN`.

---

## ⚙️ Layer 2.5: Trust & Coordination Engine (v1.7)
- **StarMap Visualization**: Decoupled D3.js engine mapping `User` relationship graph via link physics and reputation nodes.
- **Escrow Coordination Hub**: State-aware logistics layer. Coordination interfaces are dynamically injected only when `EscrowHistory` status matches `HELD`.
- **Conflict Resolution Engine**: Admin-gate with atomic resolution logic (`resolveAdminDispute`) to ensure cross-system consistency during manual overrides.

## 🗄️ Layer 3: Data (Prisma & PostgreSQL)
- **Calculated Credibility**: High-stakes trades increase the `reputationScore`.
- **Social Proof**: Badge system (`UserBadge` model) and winning streaks incentivized by the "Elite Leaderboards".

---

## 🔒 Security & Privacy Architecture
- **PII Shielding**: Automatic masking of phone numbers and critical info in chat and listings using localized regex patterns (`pii-filter.ts`).
- **Escrow Shield**: Reputation-based advance payment logic. Unverified sellers are restricted until an advance (commission + delivery) is held.
- **Transaction Isolation**: Guaranteed state consistency for the bidding engine.

## 🏆 Reputation Engine
- **Calculated Credibility**: High-stakes trades increase the `reputationScore`.
- **Social Proof**: Badge system (`UserBadge` model) and winning streaks incentivized by the "Elite Leaderboards".
