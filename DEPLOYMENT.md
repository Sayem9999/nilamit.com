# Nilamit Production Deployment Guide (v0.1.3)

This guide documents the hardened production setup for the **Nilamit Auction Platform** on Vercel.

## 🚀 Environment Variables (Vercel)

Ensure these variables are set in the Vercel Dashboard (**Settings -> Environment Variables**).

| Variable | Description | Source/Format |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supavisor pooled connection (port 6543) | `postgresql://...:6543/...` |
| `DIRECT_URL` | Direct Supabase connection for migrations | `postgresql://...:5432/...` |
| `AUTH_SECRET` | NextAuth encryption key | Random 32B string |
| `AUTH_URL` | Landing page URL | `https://nilamit.app` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Secret | Google Cloud Console |
| `PUSHER_APP_ID` | Real-time app ID | Pusher Dashboard |
| `PUSHER_KEY` | Real-time key | Pusher Dashboard |
| `PUSHER_SECRET` | Real-time secret | Pusher Dashboard |
| `PUSHER_CLUSTER` | Server region | e.g. `ap1` |
| `UPLOADTHING_TOKEN` | Image upload key | UploadThing Dashboard |
| `RESEND_API_KEY` | Transactional email key | Resend Dashboard |

---

## 🏗️ Technical Architecture

### 1. Next.js 16 Proxy System
We use the new **`src/proxy.ts`** file (replacing the deprecated `middleware.ts`).
- **Signature**: `export async function proxy(req: NextRequest)`.
- **Functionality**: Handles shared Auth session checking and i18n routing at the platform edge.
- **Vercel Note**: Vercel automatically detects this file. **Do not rename it back to middleware.ts** as it will trigger deprecation warnings.

### 2. Database & Prisma
- **Binary Targets**: The `prisma/schema.prisma` is configured with `binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]`. This is critical for Vercel's RHEL-based serverless functions.
- **Build Step**: The build command must be `prisma generate && next build`. This ensures the Prisma Client is bundled with every deployment.

### 3. Real-time (Pusher)
The frontend uses the `pusher-js` client with an exponential backoff strategy (defined in `src/lib/pusher-client.ts`) to maintain stability on mobile networks.

---

## ⏰ Automation (Crons)

Nilamit requires background tasks to automatically close auctions and process disputes.

### Vercel Cron Setup
The platform is pre-configured via `vercel.json`:
- **Path**: `/api/cron/close-auctions`
- **Schedule**: `0 * * * *` (Runs every hour).
- **Manual Trigger**: You can trigger the closing logic manually by visiting the URL with your production secret header (if configured).

---

## 📊 Administrative Tools

### 1. Database Migrations
To push schema changes to production:
```bash
npx prisma migrate deploy
```

### 2. Financial Audits
Admins can export a comprehensive **Transaction Report (CSV)** from the "System" tab in the Admin Dashboard. This includes:
- Finalized auction prices.
- Winner vs Seller details.
- Completion timestamps.

---

## ⚠️ Known Implementation Constraints
- **Dynamic-First**: Auction-related pages use `force-dynamic` to ensure bidders always see real-time bid states. Do not switch these to static generation.
- **Skeleton UI**: Loading states are handled via `loading.tsx` to provide a premium feel during SSR data fetching.

> [!TIP]
> Always verify your `DATABASE_URL` uses the **Supavisor pooler** in production to prevent "Too many connections" errors during high-activity auctions.
