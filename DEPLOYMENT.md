# 🚀 nilamit.com — Deployment Guide

## Prerequisites

- Node.js 18+ (recommended: 20+)
- A [Supabase](https://supabase.com) project (free tier works)
- A [Google Cloud Console](https://console.cloud.google.com) project for OAuth
- A domain (e.g. `nilamit.com`)

---

## 1. Supabase Setup (Database)

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a region close to Bangladesh (e.g., Singapore `ap-southeast-1`)
3. Set a strong database password
4. Once created, go to **Settings → Database → Connection string → URI**
5. Copy the connection string:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```

### Apply Database Schema

```bash
# Set DATABASE_URL in .env.local first, then:
npx prisma migrate dev --name init
```

This creates all 6 tables: `User`, `Auction`, `Bid`, `PhoneVerification`, `BidDeposit`, plus Auth.js tables.

---

## 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add authorized redirect URIs:
   - Dev: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://nilamit.com/api/auth/callback/google`
4. Copy `Client ID` and `Client Secret` into `.env.local`:
   ```
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

---

## 3. Auth Secret

Generate a secure secret:

```bash
openssl rand -base64 32
```

Add to `.env.local`:

```
AUTH_SECRET="your-generated-secret"
```

---

## 4. SMS Gateway (Phone Verification)

### Development

Leave as default — uses console logging:

```
SMS_PROVIDER="console"
```

### Production — GreenWeb SMS

1. Register at [greenweb.com.bd](https://greenweb.com.bd)
2. Get your API token
3. Set in `.env.local`:
   ```
   SMS_PROVIDER="greenweb"
   GREENWEB_TOKEN="your-token"
   ```

### Production — BulksmsBD

1. Register at [bulksmsbd.com](https://bulksmsbd.com)
2. Set in `.env.local`:
   ```
   SMS_PROVIDER="bulksmsbd"
   BULKSMS_API_KEY="your-key"
   BULKSMS_SENDER_ID="nilamit"
   ```

---

## 5. Admin Panel Access

Set comma-separated admin emails:

```
ADMIN_EMAILS="you@email.com,co-admin@email.com"
```

Access at: `https://nilamit.com/admin`

---

## 6. Free Hosting Options

### 🌟 Option A: Vercel (Recommended — Best for Next.js)

**Free tier includes:** 100GB bandwidth, serverless functions, edge network, auto-SSL, preview deploys.

**Method 1: GitHub Integration (Easiest)**

1. Push code to GitHub ✅
2. Go to [vercel.com](https://vercel.com) → **Import Project**
3. Select your `nilamit.com` repository
4. Vercel auto-detects Next.js → click **Deploy**
5. Add env vars in **Settings → Environment Variables** (see table below)

**Method 2: CLI**

```bash
npm i -g vercel
vercel
```

**Custom Domain (free on Vercel):**

1. **Settings → Domains** → Add `nilamit.com`
2. DNS: A record → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`

---

### Option B: Netlify (Free Tier)

**Free tier:** 100GB bandwidth, 300 build minutes/month.

> ⚠️ Netlify doesn't natively support Next.js server features. Use the `@netlify/plugin-nextjs` plugin.

```bash
npm i -D @netlify/plugin-nextjs
```

1. Go to [netlify.com](https://app.netlify.com) → **Import from Git**
2. Select your repo
3. Build command: `npm run build`
4. Add env vars in **Site Settings → Environment Variables**

---

### Option C: Railway (Free Tier)

**Free tier:** $5 credit/month (enough for small apps), PostgreSQL included.

> 💡 Railway can host both your app AND PostgreSQL — no Supabase needed!

1. Go to [railway.app](https://railway.app) → **New Project**
2. Deploy from GitHub
3. Add a **PostgreSQL** service (free built-in)
4. Railway auto-generates `DATABASE_URL`
5. Add remaining env vars in the dashboard

```bash
# Or use Railway CLI
npm i -g @railway/cli
railway login
railway init
railway up
```

---

### Option D: Render (Free Tier)

**Free tier:** 750 hours/month, auto-sleep after 15min inactivity (cold starts ~30s).

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Settings:
   - Build: `npm install; npx prisma generate; npm run build`
   - Start: `npm start`
4. Add env vars in the dashboard

---

### Free Tier Comparison

| Feature                  | Vercel            | Railway          | Render      | Netlify          |
| ------------------------ | ----------------- | ---------------- | ----------- | ---------------- |
| **Best for Next.js**     | ✅ Best           | ✅ Good          | ✅ Good     | ⚠️ Plugin needed |
| **Free bandwidth**       | 100GB             | Usage-based ($5) | 100GB       | 100GB            |
| **Serverless functions** | ✅                | ✅               | ❌          | ✅               |
| **Free PostgreSQL**      | ❌ (use Supabase) | ✅ Built-in      | ✅ (90 day) | ❌               |
| **Custom domain**        | ✅ Free           | ✅ Free          | ✅ Free     | ✅ Free          |
| **Auto-SSL**             | ✅                | ✅               | ✅          | ✅               |
| **Cold starts**          | None              | None             | ~30s        | None             |
| **Sleep on inactivity**  | No                | No               | Yes (15min) | No               |

> **Recommendation:** Use **Vercel** (hosting) + **Supabase free tier** (database). Both are free and this is the best combo for Next.js.

### Environment Variables (All Platforms)

| Variable               | Value                                              |
| ---------------------- | -------------------------------------------------- |
| `DATABASE_URL`         | Your Supabase/Railway PostgreSQL connection string |
| `AUTH_SECRET`          | Generated secret (`openssl rand -base64 32`)       |
| `AUTH_URL`             | `https://your-domain.com`                          |
| `GOOGLE_CLIENT_ID`     | From Google Cloud Console                          |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console                          |
| `SMS_PROVIDER`         | `console` (dev) or `greenweb`/`bulksmsbd` (prod)   |
| `GREENWEB_TOKEN`       | (if using GreenWeb)                                |
| `ADMIN_EMAILS`         | Your admin emails (comma-separated)                |

---

## 7. Alternative: Deploy to VPS (DigitalOcean/Hetzner)

```bash
# On your VPS
git clone https://github.com/Sayem9999/nilamit.com.git
cd nilamit.com
npm install
cp .env.example .env.local
# Edit .env.local with production values

npx prisma migrate deploy
npm run build
npm start
```

Use **PM2** for process management:

```bash
npm i -g pm2
pm2 start npm --name "nilamit" -- start
pm2 save
pm2 startup
```

Use **Nginx** as reverse proxy:

```nginx
server {
    listen 80;
    server_name nilamit.com www.nilamit.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

SSL with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d nilamit.com -d www.nilamit.com
```

## 8. Local Launch with Pinokio + Tailscale (Self-Hosted, Free)

> 💡 Run nilamit.com from your own PC/laptop and make it accessible on the internet — **completely free**, no cloud servers needed.

### What You Need

- [Pinokio](https://pinokio.computer) — One-click local app launcher
- [Tailscale](https://tailscale.com) — Free mesh VPN + Funnel for public access
- Your local machine running 24/7 (or whenever you want the site live)

### Step 1: Install Tailscale

1. Download from [tailscale.com/download](https://tailscale.com/download)
2. Sign in with Google/GitHub/Microsoft
3. Your machine gets a Tailscale IP (e.g., `100.x.x.x`)

### Step 2: Enable Tailscale Funnel (Public Access)

Tailscale Funnel exposes your local port to the internet with a free HTTPS URL.

```powershell
# Enable Funnel (one-time)
tailscale funnel --bg 3000
```

This gives you a public URL like:

```
https://your-machine-name.tail1234.ts.net
```

> ⚠️ **Funnel must be enabled** in Tailscale Admin Console → DNS → Enable HTTPS & Funnel

### Step 3: Set Up Project via Pinokio

Create a Pinokio script file to auto-launch nilamit.com:

**`pinokio.json`** (place in project root):

```json
{
  "title": "nilamit.com",
  "description": "Bangladesh's Trusted Auction Marketplace",
  "icon": "🏛️",
  "run": [
    {
      "method": "shell.run",
      "params": {
        "message": "npm install"
      }
    },
    {
      "method": "shell.run",
      "params": {
        "message": "npx prisma generate"
      }
    },
    {
      "method": "shell.run",
      "params": {
        "message": "npm run dev",
        "on": [
          {
            "event": "/.*(ready|started).*/i",
            "done": true
          }
        ]
      }
    }
  ]
}
```

**Or launch manually:**

```powershell
cd c:\nilamit.com
npm run dev
```

### Step 4: Configure Environment

Update `.env.local` with your Tailscale Funnel URL:

```
AUTH_URL="https://your-machine-name.tail1234.ts.net"
```

Update Google OAuth redirect URI to:

```
https://your-machine-name.tail1234.ts.net/api/auth/callback/google
```

### Step 5: Access Your Site

| Access Type           | URL                                         |
| --------------------- | ------------------------------------------- |
| **Local**             | `http://localhost:3000`                     |
| **Tailscale network** | `http://100.x.x.x:3000` (your devices)      |
| **Public (Funnel)**   | `https://your-machine-name.tail1234.ts.net` |

### Custom Domain with Tailscale

To use `nilamit.com` with Tailscale Funnel:

1. Add a CNAME record for `nilamit.com` → `your-machine-name.tail1234.ts.net`
2. Or use Tailscale's custom domain feature (requires configuring DNS)

### Pros & Cons of Local Hosting

| ✅ Pros                            | ❌ Cons                         |
| ---------------------------------- | ------------------------------- |
| Completely free forever            | Your PC must be on              |
| Full control over data             | Slower than CDN                 |
| No bandwidth limits                | No auto-scaling                 |
| Easy to debug                      | IP may change without Tailscale |
| Great for Bangladesh (low latency) |                                 |

---

## 9. Post-Deployment Checklist

- [ ] Database migrated (`npx prisma migrate deploy`)
- [ ] Google OAuth callback URL updated for production domain
- [ ] `AUTH_URL` set to production URL
- [ ] SMS gateway tested with real +880 number
- [ ] Admin panel accessible at `/admin`
- [ ] SSL certificate active (HTTPS)
- [ ] Custom domain DNS propagated

---

## 10. Monitoring & Maintenance

### Database Backups

Supabase provides automatic daily backups on paid plans. For free tier:

```bash
# Manual backup via pg_dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Logs

- **Vercel**: Dashboard → Functions → Logs
- **VPS**: `pm2 logs nilamit`

### Updates

```bash
git pull origin main
npm install
npx prisma migrate deploy
npm run build
pm2 restart nilamit  # VPS only
```
