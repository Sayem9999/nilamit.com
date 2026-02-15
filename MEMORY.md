# 🧠 nilamit.com — Project Memory

> A living document of key decisions, discoveries, and gotchas. Updated as the project evolves.

---

## Decision Log

### 2026-02-16 — Initial Architecture

| Decision  | Choice                   | Rationale                                                                        |
| --------- | ------------------------ | -------------------------------------------------------------------------------- |
| Framework | Next.js 15+ (App Router) | SSR for SEO, Server Actions for secure bid logic                                 |
| Database  | PostgreSQL via Supabase  | Real `SELECT FOR UPDATE` row locking; Supabase provides auth fallback + realtime |
| Auth      | Auth.js v5 (NextAuth)    | Google Provider + custom email OTP; extensible                                   |
| ORM       | Prisma 6                 | Type-safe queries, schema-as-code, migration history                             |
| Styling   | Tailwind CSS 4           | White/blue theme; utility-first for rapid iteration                              |
| SMS       | Pluggable interface      | GreenWeb/BulksmsBD adapters; easy to swap                                        |

### 2026-02-16 — Trust Architecture

- **Dropped NID verification** — Too much friction for C2C. Phone (+880) is the trust anchor.
- **Anti-sniping is server-enforced** — Client countdown is cosmetic; actual end_time is authoritative.
- **Bid deposits** — Schema ready but not enforced in v1. Will enable for high-value categories.

---

## Known Gotchas

1. **SQLite vs PostgreSQL**: The Vibecode prototype used SQLite with serializable transactions. Production uses PostgreSQL `SELECT FOR UPDATE` which is strictly superior for concurrent bid locking.

2. **Supabase connection pooling**: Use `?pgbouncer=true&connection_limit=1` for serverless environments (Vercel). Direct connection for migrations only.

3. **OTP rate limiting**: Must implement per-phone rate limiting (max 5 OTPs per hour) to prevent SMS gateway abuse.

4. **Timezone**: All `endTime` comparisons use UTC internally. Display converts to `Asia/Dhaka` on the client.

5. **Image uploads**: v1 uses URL strings. Future: integrate Supabase Storage or Cloudinary.

---

## Future Considerations

- [ ] Bangla (বাংলা) language support
- [ ] bKash/Nagad payment integration
- [ ] Push notifications for outbid alerts
- [ ] PWA support for offline auction browsing
- [ ] Seller verification tiers (phone → email → business registration)

---

_Update this document whenever a significant decision is made or a non-obvious problem is solved._
