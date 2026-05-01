# 🚀 Nilamit: Platform Summary

> Last Updated: April 30, 2026

**Nilamit** is a premium, real-time C2C (Consumer-to-Consumer) auction marketplace purpose-built for the unique landscape of Bangladesh. It combines enterprise-grade data integrity with social-proof mechanisms and hyper-local discovery.

## 核心 (Core) Mission
To bridge the "Trust Gap" in online trading by creating a marketplace where social accountability, legal compliance, and real-time interaction are native features, not afterthoughts.

---

## 🏗 Key Features

### 1. Real-time Auction Engine
- **One-Time Soft-Close**: Automatically extends auction time *once* by 2 minutes if a bid is placed in the final window, ensuring fair play without indefinite loops.
- **Multimodal Onboarding**: Unauthenticated browsing with signup options via **Email, Google, or Phone (OTP)**.

### 2. Trust & Coordination Hub
- **Activity Gate**: Strict identity verification required before high-value interactions (Bidding, Selling, Chatting).
- **MFS-Linked Escrow**: Mandatory **bKash/Nagad** linkage for paying advance fees.
- **Win-First Privacy**: Seller contact information is only released to the **Winning Bidder** after the auction concludes.
- **Coordination Engine**: Purpose-built for the **Cash on Delivery (COD)** culture. Nilamit handles the trust and success calculations, while users coordinate their own logistics.

### 3. Finance & Monetization
- **Success Fee Engine**: Automated, tiered platform fees (1% - 2.5%) calculated on successful sale.
- **Escrow Settlements**: Regulated PENDING -> HELD -> RELEASED funds flow for secure C2C trade.

---

## 💻 Technology Stack
- **Framework**: Next.js 16 (App Router).
- **Database**: Firebase Firestore (NoSQL).
- **Monitoring**: Sentry (Errors, Performance, Session Replay).
- **Real-time**: Firebase Realtime Database for instant bid updates and alerts.
- **Localization**: English-First experience with Bengali support via `next-intl`.
- **UI/UX**: Tailwind CSS 4, shadcn/ui, and Framer Motion for a premium, mobile-responsive aesthetic.

---

## 📚 Essential Documentation
- **[spec-kit.md](file:///c:/nilamit.com/spec-kit.md)**: Technical Standards & Gold Standard patterns.
- **[legalframework.md](file:///c:/nilamit.com/legalframework.md)**: Regulatory Compliance Framework.
- **[api.md](file:///c:/nilamit.com/api.md)**: Technical Guide for Server Actions & API.
