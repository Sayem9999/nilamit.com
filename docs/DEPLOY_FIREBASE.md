# End-to-End Deployment Guide

> www.nilamit.com — Firebase App Hosting on Google Cloud Run
> Last Updated: April 29, 2026

This guide takes you from zero to a running production deployment. Follow every step in order. Skipping steps causes silent failures — Firebase App Hosting injects secrets at runtime, so a missing secret means that feature silently breaks after deploy.

**Time required:** ~90 minutes on a fresh Google account, ~20 minutes if you already have Firebase and gcloud set up.

---

## Prerequisites

Install these before starting:

```bash
# Node.js 20+
node --version   # must be v20+

# Firebase CLI
npm install -g firebase-tools
firebase --version   # must be 13+

# Google Cloud CLI
# macOS: brew install google-cloud-sdk
# Windows: https://cloud.google.com/sdk/docs/install
gcloud --version
```

Have ready:
- A Google account (personal or Workspace)
- Your GitHub repository URL (`https://github.com/your-org/nilamit.com`)
- Credit card for GCP billing (Firebase Spark plan is free; App Hosting requires Blaze)

---

## Step 1 — Create the Firebase Project

### 1a. Create project in the console

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Project name: `nilamit-app` (or your preferred name)
4. Project ID will be generated — note it (e.g. `nilamit-app-xxxxx`). **This is your `PROJECT_ID`.**
5. Disable Google Analytics (optional)
6. Click **Create project**

### 1b. Upgrade to Blaze (pay-as-you-go)

Firebase App Hosting requires the Blaze plan:

1. In the Firebase Console, click **Upgrade** at the bottom of the left sidebar
2. Select **Blaze plan** and add a billing account
3. Set a monthly budget alert (e.g. $50) to avoid surprise bills

### 1c. Update `.firebaserc`

Open `.firebaserc` and replace the project ID:

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

### 1d. Authenticate locally

```bash
firebase login
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

---

## Step 2 — Enable Required Google Cloud APIs

Run once:

```bash
PROJECT_ID="YOUR_PROJECT_ID"

gcloud services enable \
  firestore.googleapis.com \
  firebase.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  --project="$PROJECT_ID"
```

This takes 1–2 minutes.

---

## Step 3 — Set Up Firebase Services

### 3a. Firestore

1. Firebase Console → **Firestore Database** → **Create database**
2. Select **Production mode** (rules are in `firestore.rules`)
3. Choose location: `asia-south1` (Mumbai) for Bangladesh users, or `asia-southeast1` (Singapore)
4. Click **Enable**

### 3b. Firebase Realtime Database

1. Firebase Console → **Realtime Database** → **Create database**
2. Choose **same region** as Firestore
3. Select **Start in locked mode**
4. Click **Enable**
5. Note the database URL: `https://YOUR_PROJECT_ID-default-rtdb.REGION.firebasedatabase.app`

### 3c. Firebase Storage

1. Firebase Console → **Storage** → **Get started**
2. Select **Start in production mode**
3. Choose **same region**
4. Click **Done**
5. Note the storage bucket: `YOUR_PROJECT_ID.firebasestorage.app`

### 3d. Firebase Authentication

1. Firebase Console → **Authentication** → **Get started**
2. Under **Sign-in method**, enable:
   - **Email/Password** → Enable → Save
   - **Google** (optional, needed if `GOOGLE_CLIENT_ID` is set) → Enable → add your support email → Save

---

## Step 4 — Deploy Firestore Rules, Indexes, and RTDB Rules

Deploy all security rules before the first app deploy:

```bash
# Firestore security rules
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID

# Firestore composite indexes (required for auction queries)
firebase deploy --only firestore:indexes --project YOUR_PROJECT_ID

# Firebase Storage rules
firebase deploy --only storage --project YOUR_PROJECT_ID

# Realtime Database rules
firebase deploy --only database --project YOUR_PROJECT_ID
```

Index deployment can take 5–10 minutes to build in the background. You can monitor at:
`https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes`

---

## Step 5 — Create the Firebase Service Account

The app needs a service account to write to Firestore and RTDB from the server.

1. Firebase Console → **Project Settings** (gear icon) → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file — **do not commit this file**
4. Open the JSON. You need these three values:
   - `project_id`
   - `client_email`
   - `private_key` (the entire `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----` block)

---

## Step 6 — Create All Secrets in Google Secret Manager

Every secret listed in `apphosting.yaml` must exist in Secret Manager before the first deploy. Missing secrets cause the deployment to fail at runtime.

Set your project ID once:

```bash
PROJECT_ID="YOUR_PROJECT_ID"
```

Now create each secret. Run these one at a time:

```bash
# ── Auth.js ────────────────────────────────────────────────────
# Generate a cryptographically secure 32-byte secret
echo -n "$(openssl rand -base64 32)" \
  | gcloud secrets create AUTH_SECRET --data-file=- --project=$PROJECT_ID

# ── Admin ──────────────────────────────────────────────────────
# Comma-separated list of admin email addresses (lowercase)
echo -n "admin@yourdomain.com" \
  | gcloud secrets create ADMIN_EMAILS --data-file=- --project=$PROJECT_ID

# ── Cron ───────────────────────────────────────────────────────
echo -n "$(openssl rand -hex 32)" \
  | gcloud secrets create CRON_SECRET --data-file=- --project=$PROJECT_ID

# ── Firebase Admin SDK ─────────────────────────────────────────
# From the service account JSON downloaded in Step 5:
echo -n "YOUR_PROJECT_ID" \
  | gcloud secrets create FIREBASE_PROJECT_ID --data-file=- --project=$PROJECT_ID

echo -n "firebase-adminsdk-xxxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=- --project=$PROJECT_ID

# The private key must have literal \n (not real newlines) — copy it exactly
# from the JSON file's "private_key" field value (including the quotes' content)
echo -n "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n" \
  | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=- --project=$PROJECT_ID

echo -n "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app" \
  | gcloud secrets create FIREBASE_DATABASE_URL --data-file=- --project=$PROJECT_ID

echo -n "YOUR_PROJECT_ID.firebasestorage.app" \
  | gcloud secrets create FIREBASE_STORAGE_BUCKET --data-file=- --project=$PROJECT_ID

# ── Firebase Client SDK (browser) ─────────────────────────────
# Get these from Firebase Console → Project Settings → General → Your apps → Web app
echo -n "AIzaSy..." \
  | gcloud secrets create FIREBASE_WEB_API_KEY --data-file=- --project=$PROJECT_ID

echo -n "123456789012" \
  | gcloud secrets create FIREBASE_MESSAGING_SENDER_ID --data-file=- --project=$PROJECT_ID

echo -n "1:123456789012:web:abc123def456" \
  | gcloud secrets create FIREBASE_APP_ID --data-file=- --project=$PROJECT_ID

# ── Google OAuth (optional — skip if not using Google sign-in) ─
echo -n "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" \
  | gcloud secrets create GOOGLE_CLIENT_ID --data-file=- --project=$PROJECT_ID

echo -n "GOCSPX-..." \
  | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=- --project=$PROJECT_ID
```

**Optional secrets** (add these if you have the services):

```bash
# Sentry error monitoring
echo -n "https://xxx@xxx.ingest.sentry.io/xxx" \
  | gcloud secrets create SENTRY_DSN --data-file=- --project=$PROJECT_ID

# Sentry Auth Token (required for source map uploads during build)
echo -n "sntrys_..." \
  | gcloud secrets create SENTRY_AUTH_TOKEN --data-file=- --project=$PROJECT_ID

# Note: Nilamit uses the Firebase "Trigger Email from Firestore" Extension.
# Configure your SMTP server connection (e.g., SendGrid, Mailgun, or Gmail) 
# during the extension setup in the Firebase Console under the "Extensions" tab.

# GreenWeb SMS gateway (for OTP SMS)
echo -n "your-greenweb-token" \
  | gcloud secrets create GREENWEB_TOKEN --data-file=- --project=$PROJECT_ID
```

**Verify all secrets exist:**

```bash
gcloud secrets list --project=$PROJECT_ID
```

You should see at minimum: `AUTH_SECRET`, `ADMIN_EMAILS`, `CRON_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_WEB_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`.

---

## Step 7 — Grant Cloud Build Access to Secrets

Firebase App Hosting's build and run service accounts need permission to read secrets:

```bash
PROJECT_ID="YOUR_PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Cloud Build service account (used during build)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Run service account (used at runtime)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 8 — Register a Firebase Web App

The client SDK needs an app registration:

1. Firebase Console → **Project Settings** → **General** → scroll to **Your apps**
2. Click the **Web** icon (`</>`)
3. App nickname: `nilamit-web`
4. Do NOT check "Also set up Firebase Hosting"
5. Click **Register app**
6. Copy the `firebaseConfig` values — you already created secrets from these in Step 6

---

## Step 9 — Configure Google OAuth (Optional)

Skip this step if you are not enabling Google sign-in.

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `nilamit-web`
5. **Authorized redirect URIs** — add all of these:
   ```
   http://localhost:3000/api/auth/callback/google
   https://YOUR_APP_HOSTING_URL/api/auth/callback/google
   https://YOUR_CUSTOM_DOMAIN/api/auth/callback/google
   ```
   (You will add the App Hosting URL in Step 11 after you know it)
6. Copy the Client ID and Client Secret — these are what you stored in Step 6

---

## Step 10 — Initialize Firebase App Hosting

This connects your GitHub repository to Firebase and sets up automatic deploys:

```bash
cd /path/to/nilamit.com
firebase apphosting:backends:create --project YOUR_PROJECT_ID
```

The CLI will ask you to:
1. **Region** — choose `asia-southeast1` (Singapore) for Bangladesh users
2. **Connect to GitHub** — authorize Firebase to access your repository
3. **Repository** — select your `nilamit.com` repo
4. **Branch** — `main` (deploys automatically on every push to this branch)

After this completes, Firebase will show you your App Hosting URL, e.g.:
```
https://www.nilamit.com
```

**Note this URL — you need it for the next two steps.**

---

## Step 11 — Update `AUTH_URL` in `apphosting.yaml`

Open `apphosting.yaml` and update the two hardcoded URLs:

```yaml
env:
  - variable: AUTH_URL
    value: https://YOUR-ACTUAL-APP-HOSTING-URL.hosted.app   # ← update this

  - variable: NEXT_PUBLIC_APP_URL
    value: https://YOUR-ACTUAL-APP-HOSTING-URL.hosted.app   # ← update this
```

If you have a custom domain, use that instead (after Step 16).

Commit and push this change:

```bash
git add apphosting.yaml
git commit -m "chore: set AUTH_URL to firebase app hosting URL"
git push origin main
```

Also update the Google OAuth redirect URI from Step 9 to include your App Hosting URL.

---

## Step 12 — First Deploy

Push to `main` triggers Cloud Build automatically. Watch the build:

```bash
# List your backends
firebase apphosting:backends:list --project YOUR_PROJECT_ID

# Or watch in the Firebase Console:
# Firebase Console → App Hosting → your backend → Rollouts
```

The first build takes 8–12 minutes (npm install + Next.js build). Subsequent deploys are 3–5 minutes.

**If the build fails:**
- Check the build log in Firebase Console → App Hosting → Rollouts → click the failed rollout
- The most common causes are missing secrets (Step 6) or missing IAM permissions (Step 7)

---

## Step 13 — Verify the Deployment

```bash
APP_URL="https://YOUR-APP-HOSTING-URL.hosted.app"

# Health check
curl "$APP_URL/api/health"
```

Expected response:
```json
{
  "status": "ok",
  "db": "ok",
  "latencyMs": 45,
  "uptime": 120,
  "timestamp": "2026-04-29T10:00:00.000Z",
  "version": "0.2.0"
}
```

If `db: "error"` — the service account credentials are wrong. Double-check `FIREBASE_PRIVATE_KEY` in Secret Manager (it must have literal `\n` not real newlines).

**Smoke test checklist:**
- [ ] `GET /api/health` returns `status: ok`
- [ ] Homepage loads at the App Hosting URL
- [ ] Sign-up with email/password works
- [ ] Google sign-in works (if configured)
- [ ] Creating an auction works
- [ ] Placing a bid works and the live price updates

---

## Step 14 — Set Up Cloud Scheduler (Cron Jobs)

The app needs 3 scheduled jobs. The `setup-cloud-scheduler.sh` script creates them:

```bash
# 1. Open the script and set your two values
nano scripts/setup-cloud-scheduler.sh
# → Set PROJECT_ID="YOUR_PROJECT_ID"
# → Set APP_URL="https://YOUR-APP-HOSTING-URL.hosted.app"

# 2. Run it
chmod +x scripts/setup-cloud-scheduler.sh
./scripts/setup-cloud-scheduler.sh
```

This creates:

| Job | Runs | Does |
|---|---|---|
| `nilamit-close-auctions` | Every minute | Closes expired auctions, creates escrow |
| `nilamit-process-auctions` | Every minute | Alias of above — **disable this one** (see note) |
| `nilamit-closing-soon` | Every 15 min | Sends ending-soon notifications |
| `nilamit-process-alerts` | Every 2 min | Fires price alerts |

> **Important:** `nilamit-close-auctions` and `nilamit-process-auctions` both do the same thing. Disable one to avoid double-processing:
>
> ```bash
> gcloud scheduler jobs pause nilamit-process-auctions \
>   --project=YOUR_PROJECT_ID --location=asia-southeast1
> ```

**Verify jobs:**
```bash
gcloud scheduler jobs list --project=YOUR_PROJECT_ID --location=asia-southeast1
```

**Test a job manually:**
```bash
gcloud scheduler jobs run nilamit-close-auctions \
  --project=YOUR_PROJECT_ID --location=asia-southeast1
```

---

## Step 15 — Configure SMS (for OTP)

By default the app runs with `SMS_PROVIDER=console` which logs OTPs to stdout instead of sending real SMS. In production you must configure a real SMS provider.

### Using GreenWeb SMS

1. Sign up at greenweb.com.bd and get your API token
2. Add the secret (already done in Step 6 if you ran the optional commands)
3. Add these two lines to `apphosting.yaml` under `env:`:

```yaml
  - variable: SMS_PROVIDER
    value: greenweb

  - variable: GREENWEB_TOKEN
    secret: GREENWEB_TOKEN
```

4. Commit and push to trigger a redeploy

---

## Step 16 — Configure Sentry (Error Monitoring)

Without Sentry, production errors are invisible.

1. Create a project at [sentry.io](https://sentry.io) — platform: **Next.js**
2. Copy your DSN
3. The secrets were created in Step 6. Now add the Sentry lines to `apphosting.yaml`:

```yaml
  - variable: SENTRY_DSN
    secret: SENTRY_DSN

  - variable: NEXT_PUBLIC_SENTRY_DSN
    secret: SENTRY_DSN

  - variable: SENTRY_AUTH_TOKEN
    secret: SENTRY_AUTH_TOKEN
```

4. Commit and push

---

## Step 17 — Set Up a Custom Domain (Optional)

1. Firebase Console → **App Hosting** → your backend → **Custom domain**
2. Enter your domain (e.g. `nilamit.app`)
3. Firebase provides DNS records — add them at your domain registrar
4. Wait for SSL provisioning (5 minutes to 1 hour)
5. Once active, update `apphosting.yaml`:

```yaml
  - variable: AUTH_URL
    value: https://nilamit.app   # ← your custom domain

  - variable: NEXT_PUBLIC_APP_URL
    value: https://nilamit.app
```

6. Update Google OAuth redirect URIs to include `https://nilamit.app/api/auth/callback/google`
7. Commit and push

---

## Step 18 — Production Checklist

Run through this before announcing the launch:

### Security
- [ ] `AUTH_SECRET` is 32+ random bytes (`openssl rand -base64 32`)
- [ ] `CRON_SECRET` is set and all cron jobs are authenticated
- [ ] `ADMIN_EMAILS` contains only real admin emails (lowercase)
- [ ] Firestore rules deployed and verified (`firebase deploy --only firestore:rules`)
- [ ] Storage rules deployed (`firebase deploy --only storage`)
- [ ] RTDB rules deployed (`firebase deploy --only database`)
- [ ] Google OAuth redirect URIs include your production domain only

### Functionality
- [ ] `/api/health` returns `status: ok` and `db: ok`
- [ ] Email/password signup and login work
- [ ] Phone OTP flow works end-to-end (real SMS if SMS_PROVIDER=greenweb)
- [ ] Auction creation works (image upload, all fields)
- [ ] Bidding works and live price updates via RTDB
- [ ] Buy It Now works
- [ ] Escrow flow: PENDING → HELD → RELEASED
- [ ] Cron jobs running (check Cloud Scheduler console for last run status)

### Monitoring
- [ ] Sentry receiving events (trigger a test error)
- [ ] `nilamit-process-auctions` cron is paused (only `nilamit-close-auctions` should run)
- [ ] Uptime monitor configured (UptimeRobot, Better Uptime, etc.) pointing to `/api/health`

### Performance
- [ ] Firebase App Hosting region matches your user base (asia-southeast1 for BD)
- [ ] Firestore indexes deployed and built (check Firebase Console → Firestore → Indexes)
- [ ] Consider setting `minInstances: 1` in `apphosting.yaml` if you need < 2s cold starts

---

## Ongoing Operations

### Updating a Secret

```bash
echo -n "NEW_VALUE" \
  | gcloud secrets versions add SECRET_NAME \
    --data-file=- --project=YOUR_PROJECT_ID

# Then trigger a redeploy by pushing any commit (or click Rollout in Firebase Console)
```

### Rolling Back

In Firebase Console → App Hosting → your backend → Rollouts → select any previous successful rollout → **Rollback**.

Or via CLI:
```bash
# Find rollout IDs
firebase apphosting:rollouts:list --backend YOUR_BACKEND_ID --project YOUR_PROJECT_ID

# Roll back to a specific rollout
firebase apphosting:rollouts:create YOUR_BACKEND_ID \
  --git-branch main \
  --project YOUR_PROJECT_ID
```

### Scaling for High Traffic

Edit `apphosting.yaml`:

```yaml
runConfig:
  minInstances: 1    # keeps one warm, eliminates cold starts
  maxInstances: 20   # increase cap for heavy traffic
  concurrency: 80    # requests per container
  cpu: 2             # double CPU for compute-heavy bid processing
  memoryMiB: 2048    # 2 GB for larger workloads
```

Commit and push to apply.

### Viewing Logs

```bash
# Live streaming logs
gcloud run services logs tail nilamit-app --project YOUR_PROJECT_ID --region asia-southeast1

# Or in Firebase Console → App Hosting → your backend → Logs
```

### Checking Cron Job Results

Failed cron jobs are recorded in the `cronFailures` Firestore collection. Query in the Firebase Console or:

```bash
# Trigger a manual run and check the response
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR_APP_URL/api/cron/close-auctions
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: "Secret not found" | Secret not created in Secret Manager | Run Step 6 for the missing secret |
| Build fails: "Permission denied" | Cloud Build SA missing secretAccessor role | Re-run Step 7 |
| Build fails at "preparer" | Missing secret or insufficient IAM for compute SA | Ensure `firebase-app-hosting-compute` has `secretmanager.secretAccessor` |
| `/api/health` returns `db: error` | Wrong `FIREBASE_PRIVATE_KEY` format | Ensure the key has `\n` (not real newlines) in Secret Manager |
| Auth redirect loop | `AUTH_URL` doesn't match deployment domain | Update `apphosting.yaml` Step 11 and push |
| Google sign-in fails | Redirect URI not authorized | Add App Hosting URL to OAuth client in GCP Console (Step 9) |
| Cron returns 401 | `CRON_SECRET` mismatch | Re-run `setup-cloud-scheduler.sh` after updating the secret |
| OTPs not sending | `SMS_PROVIDER` not set or `GREENWEB_TOKEN` missing | Step 15 |
| Cold start latency > 5s | `minInstances: 0` (scales to zero) | Set `minInstances: 1` in `apphosting.yaml` |
| Firestore queries slow | Indexes not built yet | Wait 10 min after `firebase deploy --only firestore:indexes` |

---

## File Reference

| File | Purpose |
|---|---|
| `apphosting.yaml` | Cloud Run settings + all env/secrets mapping |
| `cloudbuild.yaml` | Build pipeline: `npm ci` → `npm run build` |
| `firebase.json` | Firebase CLI project config |
| `.firebaserc` | Maps `default` to your Firebase project ID |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Composite indexes for all queries |
| `storage.rules` | Firebase Storage security rules |
| `database.rules.json` | RTDB security rules |
| `scripts/setup-cloud-scheduler.sh` | Creates/updates all 4 cron jobs |
| `src/app/api/health/route.ts` | Health check endpoint |
| `src/lib/env.ts` | Runtime env validation — throws on missing required vars |
