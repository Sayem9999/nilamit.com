# 🚀 Nilamit: Platform Summary

> Last Updated: May 2, 2026

**Nilamit** is a premium, real-time C2C (Consumer-to-Consumer) auction marketplace purpose-built for the unique landscape of Bangladesh. It combines enterprise-grade data integrity with social-proof mechanisms and hyper-local discovery.

## 核心 (Core) Mission
To bridge the "Trust Gap" in online trading by creating a marketplace where social accountability, legal compliance, and real-time interaction are native features, not afterthoughts.

---

## 🏗 Key Features

### 1. Real-time Auction Engine
- **One-Time Soft-Close**: Automatically extends auction time *once* by 2 minutes if a bid is placed in the final window, ensuring fair play without indefinite loops.
- **Seamless Auth & Avatar Sync**: Unauthenticated browsing with signup/login via **Email or Google OAuth**, featuring automatic profile avatar sync and premium client uploader.

### 2. Trust & Coordination Hub
- **Activity Gate**: Strict identity verification required before high-value interactions.
- **Zero-Loss Logistics**: 120 BDT RTO deduction to protect sellers from courier losses.
- **eBay-style Trust**: "Top Rated" and "Business Retailer" badges based on performance metrics.
- **Coordination Engine**: Purpose-built for COD culture with integrated financial security.

### 3. Finance & Monetization
- **Success Fee Engine**: Automated, tiered platform fees (1% - 2.5%) calculated on successful sale.
- **Escrow Settlements**: Secure PENDING -> HELD -> RELEASED funds flow for C2C trade.
- **Bidding Advancement**: Proxy Bidding (Auto-Max) and Second Chance Offer support.

---

## 💻 Technology Stack
- **Framework**: Next.js 16 (App Router).
- **Database**: Firebase Firestore (NoSQL).
- **Monitoring**: Sentry (Errors, Performance, Session Replay).
- **Real-time**: Firebase Realtime Database for instant bid updates and alerts.
- **Localization**: English-only (Bengali dropped; `next-intl` layer retained for future expansion).
- **UI/UX**: Tailwind CSS 4, shadcn/ui, and Framer Motion for a premium, mobile-responsive aesthetic.

---

## 📚 Essential Documentation
- **[spec-kit.md](file:///c:/nilamit.com/spec-kit.md)**: Technical Standards & Gold Standard patterns.
- **[legalframework.md](file:///c:/nilamit.com/legalframework.md)**: Regulatory Compliance Framework.
- **[api.md](file:///c:/nilamit.com/api.md)**: Technical Guide for Server Actions & API.
