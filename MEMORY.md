# 🧠 nilamit.com — Project Memory & Constitution

> A living document of key decisions, discoveries, and agent operating rules. Updated as the project evolves.

---

## Agent Constitution (CRITICAL RULES)

1. **LEARN FROM PAST MISTAKES**: Do not make the same mistake twice. When a bug (like the D3 `ReferenceError`) occurs due to initialization order or missing dependencies, _internalize_ this pattern for all future files.
2. **FUTURE-PROOFING**: Always anticipate edge cases based on prior failures. If an HTML artifact renders empty, immediately suspect script errors or import failures before replacing files blindly.

---

## Decision Log

### 2026-02-16 — Initial Architecture

| Decision  | Choice                   | Rationale                                                                        |
| --------- | ------------------------ | -------------------------------------------------------------------------------- |
| Framework | Next.js 15+ (App Router) | SSR for SEO, Server Actions for secure bid logic                                 |
| Database  | PostgreSQL via Supabase  | Real `SELECT FOR UPDATE` row locking; Supabase provides auth fallback + realtime |
| Auth      | Auth.js v5 (NextAuth)    | Google Provider + custom email OTP; extensible                                   |
| ORM       | Prisma 7                 | Type-safe queries, schema-as-code, migration history                             |
| Styling   | Tailwind CSS 4           | White/blue theme; utility-first for rapid iteration                              |
| SMS       | Pluggable interface      | GreenWeb/BulksmsBD adapters; easy to swap                                        |
| Images    | Uploadthing              | Drag-and-drop support; replaces brittle manual URL entry                         |
| Updates   | Polling (5s)             | Real-time price updates for active auctions without full refresh                 |
| Notify    | Email Notifications      | Automated alerts via Resend whenever a user is outbid                            |

### 2026-02-16 — Infrastructure & Local Hosting

| Item             | Details                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Pinokio Location | `C:\pinokio` — local app launcher                                                                |
| Pinokio App      | `C:\pinokio\api\nilamit.com` — 5 scripts (pinokio.js, install.js, start.js, update.js, reset.js) |
| Tailscale        | Public URL: `https://desktop-ajdgsgd.tail4e4049.ts.net/` via Funnel                              |
| Project Dir      | `c:\nilamit.com`                                                                                 |
| GitHub Repo      | `Sayem9999/nilamit.com`                                                                          |

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

6. **Prisma 7 breaking change**: Datasource `url` no longer goes in `schema.prisma`. It's now in `prisma.config.ts`. The schema only has `provider`.

7. **D3 & React Integration**: Strict Top-Down Initialization. When building D3 graphs in `useEffect` (like the Star Map), always initialize generic selections (`svg`, `g`, `defs`) _before_ applying handlers that reference them. E.g. defining `.on("zoom", () => g.attr(...))` will crash with a `ReferenceError` if `g` is initialized later in the hook.

---

## Future Considerations

- [ ] Bangla (বাংলা) language support
- [ ] bKash/Nagad payment integration
- [ ] Push notifications for outbid alerts
- [ ] PWA support for offline auction browsing
- [ ] Seller verification tiers (phone → email → business registration)

---

_Update this document whenever a significant decision is made or a non-obvious problem is solved._
