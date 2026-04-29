# Security Architecture

> Last Updated: April 29, 2026

---

## Threat Model

Nilamit is a financial marketplace handling real money (bKash/Nagad escrow). The primary threats are:

- **Shill bidding** — sellers bidding on their own auctions
- **Bid manipulation** — exploiting race conditions to place concurrent invalid bids
- **Account takeover** — brute-forcing credentials or OTPs
- **Platform circumvention** — sharing contact info to transact off-platform
- **Admin impersonation** — escalating to admin privileges
- **Data exfiltration** — scraping user PII

---

## Defense in Depth

Every request passes through four security layers before touching data:

```
1. Middleware         → ban check, auth redirect, i18n routing
2. Server Action      → session check, Zod validation, rate limiting
3. Service layer      → business rule enforcement, ownership checks
4. Firestore rules    → all client writes blocked unconditionally
```

---

## Authentication

### Session Strategy

Auth.js v5 with JWT strategy. Sessions are stateless (not stored in DB). The JWT is signed with `AUTH_SECRET` (32+ byte random value, validated at startup).

### Token Refresh

The JWT callback re-reads the user document from Firestore every **5 minutes** (or on `trigger === 'update'`). This ensures security-critical fields (`isBanned`, `isPhoneVerified`, `isVerifiedSeller`) propagate within 5 minutes of an admin action.

### Admin Authorization

Admin status is **derived exclusively from the `ADMIN_EMAILS` environment variable** — never from user-supplied data or a database field. The `requireAdmin()` function in `src/lib/admin-guard.ts` is the single canonical gate. It normalizes email to lowercase before comparison.

All admin-only Server Actions call `requireAdmin()`. Inline re-implementations of the admin check are prohibited.

### Password Hashing

Passwords are hashed with bcrypt (cost factor 10) at registration and password reset. The schema enforces 8–128 character passwords — length is capped to prevent bcrypt's 72-byte truncation from being surprising, and to prevent OOM on oversized payloads.

---

## OTP Security

Phone and email OTPs are 6-digit codes.

- **Generation:** `crypto.randomInt(100_000, 1_000_000)` — CSPRNG, not `Math.random()`
- **Storage:** SHA-256 hash stored in `phoneVerifications` collection. The plaintext OTP is never written to the database.
- **Expiry:** 5 minutes
- **Attempts:** Max 5 attempts per OTP. After 5 failures, the OTP is exhausted.
- **Rate limiting:** 5 OTP sends per hour per phone number (Upstash + Firestore double-check)
- **Verify rate limiting:** 5 verify attempts per 15 minutes per phone number (Upstash)

Email OTPs (for password reset) are stored as plaintext in `verificationTokens` — this is an Auth.js adapter convention. Verification token doc IDs are SHA-256 hashes of `identifier:token` to prevent ambiguous compound keys.

---

## Rate Limiting

All rate limiting uses Upstash Redis (sliding window algorithm) and **fails closed in production** — if Redis is unreachable, requests are rejected, not allowed through.

| Limiter | Limit | Window | Applied to |
|---|---|---|---|
| `apiLimiter` | 100 req | 60s | File uploads |
| `authLimiter` | 10 req | 15min | Auth endpoints |
| `bidLimiter` | 60 bids | 60s | `placeBid`, `executeBuyItNow` |
| `loginLimiter` | 20 req | 5min | Login, register, password reset |
| `phoneOtpSendLimiter` | 5 sends | 1 hour | Per phone number |
| `phoneOtpVerifyLimiter` | 5 attempts | 15min | Per phone number |
| `emailOtpSendLimiter` | 5 sends | 1 hour | Per email address |

Rate limit keys include both user ID and IP address for bid limiting, preventing IP rotation attacks.

---

## Data Integrity

### Atomic Transactions

All operations that modify multiple documents use `db.runTransaction()`, not `db.batch()`. Batches provide atomic commits but not serializable reads — two concurrent bids could both read the same "current price" and both succeed. Transactions lock documents at read time.

The bid transaction reads and locks `auctionRef` via `tx.get(aRef)`. The `currentPrice` and `currentBidderId` fields are denormalized onto the auction document so they can be read within the transaction lock (collection queries inside a transaction are not transactionally locked).

### Reserve Price Enforcement

The `processAuctionSale()` function in `src/lib/auction-logic.ts` checks reserve price before marking an auction SOLD. This is the single entry point for auction sale finalization — both cron routes use it.

### Escrow Atomicity

`markAsShipped()`, `payEscrowAdvance()`, and `confirmItemReceived()` all run inside `db.runTransaction()`. Status checks and ownership checks happen inside the transaction lock, preventing TOCTOU races.

### Shill Bid Detection

`detectShillBidding()` runs asynchronously after each bid commit. It checks bid patterns for suspicious activity and can flag auctions for admin review.

---

## Firestore Security Rules

All client-side writes are blocked unconditionally. This is the last line of defense — even if a Server Action had a bug, a malicious client cannot write directly to Firestore.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /auctions/{auctionId} {
      allow read: if true;
      allow write: if false;  // Admin SDK only
    }
    // ... same pattern for all collections
    match /{document=**} {
      allow read, write: if false;  // catch-all deny
    }
  }
}
```

The `isAdmin()` helper in rules checks `request.auth.token.isAdmin == true`. This custom claim is set in the JWT via the Auth.js callback — derived from `ADMIN_EMAILS` env var, not user data.

---

## Content Security Policy

Set in `next.config.ts` for all routes:

```
default-src 'self'
script-src  'self' 'unsafe-inline' [trusted CDNs]
style-src   'self' 'unsafe-inline' [Google Fonts]
img-src     'self' data: blob: [Firebase Storage, UploadThing, Google]
connect-src 'self' [Firebase, Upstash, Sentry, UploadThing, Pusher]
frame-src   'self' [Firebase apps]
object-src  'none'
base-uri    'self'
form-action 'self'
frame-ancestors 'none'
upgrade-insecure-requests
```

`'unsafe-eval'` is **not** present. `'unsafe-inline'` on script-src is required for Next.js App Router hydration scripts (inline `<script>` tags). Nonce-based CSP would remove this requirement but requires per-request middleware changes.

Additional headers:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## PII Protection

The `filterPII()` function in `src/lib/pii-filter.ts` strips the following from any user-generated text (descriptions, reviews, chat) before storage and display:

- Bangladesh phone numbers in English and Bengali digits (`+880`, `01xxx`)
- Email addresses
- Phonetic digit words ("ek", "dui", "tin" etc. — common bypass)
- Off-platform contact keywords ("WhatsApp", "inbox", "contact", "ফোন", "নম্বর")

This prevents buyers and sellers from circumventing the escrow system by transacting directly.

---

## Secrets Management

In production (Firebase App Hosting), all secrets are stored in **Google Secret Manager** and injected at container start — never baked into the image.

The `FIREBASE_PRIVATE_KEY` secret is never written to any log. The `sentry-scrub.ts` module scrubs known secret patterns from error reports before they reach Sentry.

Local `.env` files are gitignored via `.env*` in `.gitignore`. The `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` values in `.env` must be rotated if that file was ever committed to git history.

To generate a new `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

---

## Cron Job Security

All cron endpoints require `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret: <CRON_SECRET>`. In production without a `CRON_SECRET` configured, all cron requests are rejected with HTTP 500 (not silently allowed).

Cloud Scheduler authenticates using the configured `CRON_SECRET` value, which is stored in Google Secret Manager and never in source code.

---

## Known Limitations

- `'unsafe-inline'` in `script-src` cannot be removed without nonce infrastructure.
- Auth.js v5 is still in beta — monitor for security advisories.
- Email OTPs are stored in plaintext in `verificationTokens` (Auth.js convention) — short TTL (5 min) mitigates this.
- The `ADMIN_EMAILS` list is a flat env var — no per-action RBAC. All admins have the same permissions.
