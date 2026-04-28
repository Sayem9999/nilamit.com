# Nilamit — Firebase App Hosting Deployment Guide

Complete step-by-step guide to deploy nilamit.app on Firebase App Hosting (Google Cloud Run).

---

## Prerequisites

- Node.js 20+ installed locally
- A GitHub account with the nilamit repo pushed
- A Google account (for Firebase / GCP)
- Your Supabase database already running
- All third-party keys ready (Pusher, UploadThing, Resend, etc.)

---

## Step 1 — Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

Verify you're logged in:

```bash
firebase projects:list
```

---

## Step 2 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project**
3. Name it `nilamit-app` (or your preferred ID)
4. Disable Google Analytics (optional)
5. Click **Create project**

Note your **Project ID** — you'll use it throughout this guide (referred to as `YOUR_PROJECT_ID`).

---

## Step 3 — Update Project Files

### 3a. Update `.firebaserc`

Open `.firebaserc` and replace the placeholder:

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

Replace `YOUR_PROJECT_ID` with your actual Firebase project ID (e.g., `nilamit-app`).

### 3b. Update `apphosting.yaml`

Find this line:

```yaml
value: https://YOUR_DOMAIN.web.app
```

Replace with your Firebase App Hosting URL (you'll get this in Step 6, but it follows the pattern `https://YOUR_PROJECT_ID.web.app`). You can also use a custom domain here once configured.

### 3c. Update `scripts/setup-cloud-scheduler.sh`

```bash
PROJECT_ID="nilamit-app"           # ← your Firebase project ID
APP_URL="https://nilamit-app.web.app"  # ← your app URL
```

---

## Step 4 — Add All Secrets to Google Secret Manager

Every secret in `apphosting.yaml` must exist in Secret Manager **before** the first deploy.

Run these commands (replace placeholder values with your actual secrets):

```bash
PROJECT_ID="nilamit-app"  # ← set this once

# Database (Supabase PostgreSQL connection string)
echo -n "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?pgbouncer=true" \
  | gcloud secrets create DATABASE_URL --data-file=- --project=$PROJECT_ID

# Auth.js secret (generate a random 32-byte secret)
echo -n "$(openssl rand -base64 32)" \
  | gcloud secrets create AUTH_SECRET --data-file=- --project=$PROJECT_ID

# Google OAuth (optional — skip if not using Google sign-in)
echo -n "YOUR_GOOGLE_CLIENT_ID" \
  | gcloud secrets create GOOGLE_CLIENT_ID --data-file=- --project=$PROJECT_ID
echo -n "YOUR_GOOGLE_CLIENT_SECRET" \
  | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=- --project=$PROJECT_ID

# Admin emails (comma-separated)
echo -n "admin@nilamit.com" \
  | gcloud secrets create ADMIN_EMAILS --data-file=- --project=$PROJECT_ID

# Cron secret (used by Cloud Scheduler to authenticate cron API calls)
echo -n "$(openssl rand -hex 32)" \
  | gcloud secrets create CRON_SECRET --data-file=- --project=$PROJECT_ID

# Pusher
echo -n "YOUR_PUSHER_APP_ID"  | gcloud secrets create PUSHER_APP_ID  --data-file=- --project=$PROJECT_ID
echo -n "YOUR_PUSHER_KEY"     | gcloud secrets create PUSHER_KEY     --data-file=- --project=$PROJECT_ID
echo -n "YOUR_PUSHER_SECRET"  | gcloud secrets create PUSHER_SECRET  --data-file=- --project=$PROJECT_ID
echo -n "mt1"                 | gcloud secrets create PUSHER_CLUSTER --data-file=- --project=$PROJECT_ID

# Supabase Storage
echo -n "https://[REF].supabase.co" \
  | gcloud secrets create SUPABASE_URL --data-file=- --project=$PROJECT_ID
echo -n "YOUR_SUPABASE_ANON_KEY" \
  | gcloud secrets create SUPABASE_ANON_KEY --data-file=- --project=$PROJECT_ID
echo -n "YOUR_SUPABASE_SERVICE_ROLE_KEY" \
  | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=- --project=$PROJECT_ID

# UploadThing
echo -n "YOUR_UPLOADTHING_TOKEN" \
  | gcloud secrets create UPLOADTHING_TOKEN --data-file=- --project=$PROJECT_ID

# Resend (email)
echo -n "re_YOUR_RESEND_KEY" \
  | gcloud secrets create RESEND_API_KEY --data-file=- --project=$PROJECT_ID

# SMS (GreenWeb)
echo -n "YOUR_GREENWEB_TOKEN" \
  | gcloud secrets create GREENWEB_TOKEN --data-file=- --project=$PROJECT_ID
```

To **update** an existing secret later:

```bash
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=- --project=$PROJECT_ID
```

---

## Step 5 — Enable Required Google APIs

```bash
PROJECT_ID="nilamit-app"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  --project=$PROJECT_ID
```

---

## Step 6 — Initialize Firebase App Hosting

```bash
cd /path/to/nilamit.app

firebase apphosting:backends:create --project nilamit-app
```

The CLI will ask you to:
1. Choose a region (pick `us-central1` for lowest latency globally, or `asia-south1` for South Asia)
2. Connect your GitHub repository
3. Choose the branch to deploy from (e.g., `main`)

After this, Firebase will:
- Show you your App Hosting URL (e.g., `https://nilamit-app--main-abc123.web.app`)
- Set up automatic deploys on every push to `main`

> **Important:** Go back and update `apphosting.yaml` → `AUTH_URL` with this URL if you haven't already.

---

## Step 7 — Grant Cloud Build Access to Secrets

Firebase App Hosting's Cloud Build service account needs permission to read your secrets:

```bash
PROJECT_ID="nilamit-app"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Grant Secret Manager access to the Cloud Build service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Also grant to the Cloud Run service account (for runtime secret access)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 8 — Trigger First Deploy

Push to your connected branch:

```bash
git add .
git commit -m "chore: firebase app hosting migration"
git push origin main
```

Firebase App Hosting will automatically trigger a Cloud Build that:
1. Installs dependencies (`npm ci`)
2. Runs `npm run build` (Next.js build)
3. Deploys the standalone container to Cloud Run

> **Local builds without secrets:** `npm run build` fail-closes by default if required env vars are missing — that is what protects production deploys. To run a local build with placeholder/missing secrets (e.g. for type-checking the build output), set `LOCAL_BUILD=1`:
> ```bash
> LOCAL_BUILD=1 npm run build
> ```
> Never set `LOCAL_BUILD` in any deploy environment.

Watch the build in the [Firebase Console](https://console.firebase.google.com) → your project → **App Hosting**.

Or via CLI:

```bash
firebase apphosting:backends:list --project nilamit-app
```

---

## Step 9 — Set Up Cloud Scheduler (Cron Jobs)

Once the app is deployed and running:

```bash
chmod +x scripts/setup-cloud-scheduler.sh
./scripts/setup-cloud-scheduler.sh
```

This creates 4 scheduled jobs:

| Job | Schedule | Endpoint |
|-----|----------|----------|
| `nilamit-process-auctions` | Every minute | `/api/cron/process-auctions` |
| `nilamit-close-auctions` | Every minute | `/api/cron/close-auctions` |
| `nilamit-closing-soon` | Every 15 min | `/api/cron/closing-soon` |
| `nilamit-process-alerts` | Every 2 min | `/api/cron/process-alerts` |

Verify in the [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler).

Test a job manually:

```bash
gcloud scheduler jobs run nilamit-process-auctions \
  --project=nilamit-app \
  --location=us-central1
```

---

## Step 10 — Configure Custom Domain (Optional)

1. In Firebase Console → App Hosting → your backend → **Custom domain**
2. Add your domain (e.g., `nilamit.app`)
3. Add the provided DNS records to your domain registrar
4. Wait for SSL provisioning (usually < 1 hour)
5. Update `apphosting.yaml` → `AUTH_URL` to your custom domain
6. Push to trigger a redeploy

---

## Step 11 — Verify Everything is Working

### Health check

```bash
curl https://YOUR_DOMAIN.web.app/api/health
```

Expected response:

```json
{
  "status": "ok",
  "db": "connected",
  "latencyMs": 12,
  "uptime": 3600,
  "timestamp": "2026-04-15T10:00:00.000Z"
}
```

### Test authentication

Visit your app and sign in with email/password and (if configured) Google OAuth.

### Test real-time bidding

Create an auction and place a bid — the Pusher real-time updates should work.

### Test cron jobs

Check the Cloud Scheduler console to confirm all 4 jobs ran successfully.

---

## Updating Secrets After Deploy

```bash
# Example: update DATABASE_URL
echo -n "NEW_DATABASE_URL" \
  | gcloud secrets versions add DATABASE_URL --data-file=- --project=nilamit-app

# Then trigger a redeploy by pushing any commit, or via the Firebase console
```

---

## Scaling Configuration

Current settings in `apphosting.yaml` (suitable for production):

| Setting | Value | Notes |
|---------|-------|-------|
| `minInstances` | 0 | Scales to zero when idle (saves cost) |
| `maxInstances` | 10 | Cap to control costs |
| `concurrency` | 80 | Requests per container |
| `cpu` | 1 vCPU | Sufficient for Next.js + Prisma |
| `memoryMiB` | 1024 | 1 GB RAM |
| `timeoutSeconds` | 60 | Max request duration |

For higher traffic, increase `minInstances` to 1 (eliminates cold starts) and `maxInstances` to 20+.

---

## Troubleshooting

**Build fails with "Prisma binary not found"**
→ Check that `prisma/schema.prisma` has `debian-openssl-1.1.x` and `debian-openssl-3.0.x` in `binaryTargets`. ✅ Already added.

**"Secret not found" during build**
→ Run Step 7 again to ensure the Cloud Build service account has `secretmanager.secretAccessor` role.

**Auth redirect loop**
→ Ensure `AUTH_URL` in `apphosting.yaml` matches your actual deployment domain exactly (including `https://`).

**Cron jobs failing with 401**
→ Check that `CRON_SECRET` in Secret Manager matches what Cloud Scheduler is sending. Re-run `setup-cloud-scheduler.sh` to refresh.

**Cold start latency**
→ Set `minInstances: 1` in `apphosting.yaml` to keep one container warm at all times.

**"next start" error on Cloud Run**
→ The `start` script is now `node .next/standalone/server.js` — this is correct for the standalone output mode required by Cloud Run.

---

## File Reference

| File | Purpose |
|------|---------|
| `firebase.json` | Firebase project config (App Hosting enabled) |
| `apphosting.yaml` | Cloud Run settings + all env/secrets mapping |
| `.firebaserc` | Maps `default` to your Firebase project ID |
| `cloudbuild.yaml` | Build pipeline: install → migrate → build |
| `scripts/setup-cloud-scheduler.sh` | Creates/updates all 4 cron jobs in Cloud Scheduler |
| `prisma/schema.prisma` | Includes Debian binary targets for Cloud Run |
| `src/middleware.ts` | Rate limiting + auth guard + i18n routing |
| `src/lib/auth.config.ts` | Edge-safe NextAuth config (used in middleware) |
| `src/lib/auth.ts` | Full NextAuth config with Prisma adapter |
| `src/app/api/health/route.ts` | Health check endpoint (`/api/health`) |
