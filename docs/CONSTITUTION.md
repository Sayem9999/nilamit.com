# 🏛️ nilamit.com — Project Constitution

> Last Updated: April 29, 2026

> The non-negotiable principles governing every decision in this codebase.

## Core Identity

**nilamit.com** is Bangladesh's first dedicated C2C auction marketplace. "Nilam" (নিলাম) means "auction" in Bengali. We build for the **99%** — the Dhaka shopkeeper selling surplus stock, the Chittagong student selling a used phone, the Sylhet homemaker finding a deal.

---

## Architectural Commandments

### 1. Mobile-First, Always

- 70%+ of Bangladeshi internet users are on mobile with 3G/4G
- Every page must be usable on a ৳3,000 ($27) phone with a 4.5" screen
- Target: First Contentful Paint < 2s on 3G emulation
- **No feature ships without a mobile viewport test**

### 2. Trust Without Friction

- Phone or Email verification (+880 / OTP / Email link) is the Trust Anchor — not NID, not passport
- Users should be able to **browse** freely; verification gates only at **action points** (bid, sell)
- A verified email creates accountability in a culture of trusted commerce

### 3. Data Integrity & Trust Shield

- Every bid MUST go through a serializable database transaction
- `SELECT FOR UPDATE` row locking on the auction row prevents race conditions
- Anti-sniping (Soft Close): 2-minute extension on last-moment bids — this is **non-negotiable**
- **Trust Shield**: Coordination chat is strictly gated by Escrow (Advance payment for logistics).

### 4. English-First Experience

- The primary language for all system interactions, technical terms, and legal documentation is **English**.
- **Bengali (বাংলা)** remains a secondary, localized support option for accessibility, but the core design follows global standard English UX patterns.
- Currency remains BDT (৳) for local market relevance.
- Date/time displays respect `Asia/Dhaka` (UTC+6).

### 5. No Dark Patterns

- No hidden fees, no fake urgency counters, no phantom bids
- Bid history is public and transparent
- Reputation scores are earned, never bought

---

## Non-Negotiable Technical Rules

1. **Never trust the client** — all bid validation happens server-side in Server Actions
2. **Never store OTP plaintext** — hash before storage
3. **Never skip verification (email)** — no backdoors for bidding/selling
4. **Always use parameterized queries** — Firestore handles this, never raw-dog SQL
5. **Always handle errors gracefully** — show Bengali-friendly error messages
6. **No Quick Fixes / Placeholders** — Implementation must be production-ready. No `console.log` for critical notifications (email/SMS). No bypassing logic. If a feature isn't ready, disable it.
7. **Launch Readiness Protocol** — Every user flow (Bid, Sell, Auth) must be usable by a non-technical user. No manual image URLs; must use integrated uploads. No silent outbids; must use notifications.

---

## Design Philosophy

| Principle                 | Implementation                                                |
| ------------------------- | ------------------------------------------------------------- |
| **White & Blue**          | Clean, trustworthy, institutional — like a bank, not a bazaar |
| **Glassmorphism**         | Subtle, modern depth without heaviness                        |
| **Micro-animations**      | Bid confirmations, countdown pulses, card hovers              |
| **Information hierarchy** | Price → Time Remaining → Item → Seller (in that order)        |

---

## Performance Targets

| Metric                   | Target    | Measured On         |
| ------------------------ | --------- | ------------------- |
| First Contentful Paint   | < 2.0s    | 3G throttled Chrome |
| Largest Contentful Paint | < 3.5s    | 3G throttled Chrome |
| Time to Interactive      | < 4.0s    | 3G throttled Chrome |
| Cumulative Layout Shift  | < 0.1     | All viewports       |
| Concurrent bid handling  | 500 users | Peak auction close  |

---

_This document is the law. Any PR that violates these principles must be explicitly justified and approved._
