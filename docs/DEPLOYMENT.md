# Deployment Guide

> Last Updated: April 29, 2026

Nilamit runs on **Firebase App Hosting** — a managed Google Cloud Run backend with git-triggered deployments. Pushing to `main` automatically triggers a Cloud Build pipeline that builds and deploys the app.

For the full step-by-step first-time setup, see [DEPLOY_FIREBASE.md](DEPLOY_FIREBASE.md).

---

## How Deployment Works

```
git push origin main
  → GitHub triggers Firebase App Hosting webhook
  → Cloud Build runs cloudbuild.yaml:
       1. npm install
       2. npm run build  (Next.js standalone build)
  → Built container deployed to Cloud Run
  → New traffic served within ~3 minutes
```

No manual deploy commands are needed once Firebase App Hosting is connected to the repository.

---

## Key Config Files

| File | Purpose |
|---|---|
| `apphosting.yaml` | Cloud Run settings + all env/secrets mapping |
| `cloudbuild.yaml` | Build pipeline steps |
| `firebase.json` | Firebase CLI project config |
| `.firebaserc` | Maps `default` to your Firebase project ID |
| `scripts/setup-cloud-scheduler.sh` | Creates/updates all 4 Cloud Scheduler cron jobs |

---

## Environment Variables

All secrets are stored in **Google Secret Manager** and referenced in `apphosting.yaml`. They are injected into the container at runtime — never baked into the image.

To add or update a secret:
```bash
# Add new secret
echo -n "SECRET_VALUE" | gcloud secrets create SECRET_NAME --data-file=- --project=YOUR_PROJECT_ID

# Update existing secret
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=- --project=YOUR_PROJECT_ID
```

After updating a secret, trigger a redeploy by pushing any commit (or via the Firebase Console → App Hosting → Rollout).

Required secrets — see `.env.example` for full list:

| Secret | Description |
|---|---|
| `AUTH_SECRET` | JWT signing key — `openssl rand -base64 32` |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `CRON_SECRET` | Shared secret for Cloud Scheduler → cron routes |
| `ADMIN_EMAILS` | Comma-separated admin email list |

---

## Cron Jobs

Four Cloud Scheduler jobs send POST requests to the deployed app every minute (or on schedule). Set up once with:

```bash
chmod +x scripts/setup-cloud-scheduler.sh
./scripts/setup-cloud-scheduler.sh
```

| Job | Endpoint | Schedule |
|---|---|---|
| `nilamit-close-auctions` | `POST /api/cron/close-auctions` | Every minute |
| `nilamit-process-auctions` | `POST /api/cron/process-auctions` | Every minute (alias — run only one) |
| `nilamit-closing-soon` | `POST /api/cron/closing-soon` | Every 15 minutes |
| `nilamit-process-alerts` | `POST /api/cron/process-alerts` | Every 2 minutes |

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`. In production without `CRON_SECRET` set, all cron requests are rejected.

Manually trigger a job:
```bash
gcloud scheduler jobs run nilamit-close-auctions \
  --project=YOUR_PROJECT_ID \
  --location=asia-southeast1
```

---

## Scaling

Current `apphosting.yaml` settings:

| Setting | Value | Notes |
|---|---|---|
| `minInstances` | 0 | Scales to zero when idle — costs nothing |
| `maxInstances` | 10 | Cap to control costs |
| `concurrency` | 80 | Requests per container instance |
| `cpu` | 1 vCPU | Sufficient for Next.js + Firestore |
| `memoryMiB` | 1024 | 1 GB RAM |
| `timeoutSeconds` | 60 | Max request duration |

For production traffic with latency requirements, set `minInstances: 1` to eliminate cold starts.

---

## Health Check

```bash
curl https://YOUR_DOMAIN/api/health
```

Expected:
```json
{ "status": "ok", "db": "connected", "latencyMs": 15, "timestamp": "..." }
```

---

## Monitoring

- **Errors:** Sentry dashboard (`SENTRY_DSN` env var)
- **Logs:** Firebase Console → App Hosting → Logs (streamed from Cloud Run)
- **Cron failures:** `cronFailures` Firestore collection — admin-readable
- **Build status:** Firebase Console → App Hosting → Rollouts

---

## Rollback

In the Firebase Console → App Hosting → your backend → Rollouts, select any previous successful rollout and click **Rollback**.

Or redeploy a specific commit:
```bash
git push origin <commit-sha>:main --force
```

## Firestore Rules & Indexes (AUTOMATED)

Composite indexes are defined in `firestore.indexes.json` and security rules in `firestore.rules`. These are now **100% automated** to ensure your production database schemas, index paths, and access permissions are always synchronized with your source code:

### 1. Local Autopilot (Husky Git Hook)
Whenever you push your code to the `main` branch locally, your machine automatically triggers the deployment of indexes and rules:
* Hook Location: `.husky/pre-push`
* Deployment Command: `npx firebase deploy --only firestore --project=nilamit-52073`
* Safe Fallback: If you are pushing from a machine that doesn't have `firebase` installed or isn't authenticated, the hook prints a warning and completes the push safely without blocking you.

### 2. Cloud Autopilot (GitHub Actions CI/CD)
When code is pushed or a pull request is merged into `main`, GitHub Actions automatically compiles, tests, and deploys the rules and indexes:
* Workflow Location: `.github/workflows/ci.yml` (Step: `deploy-firestore`)
* Authentication: Reads from the `FIREBASE_TOKEN` secret stored in your GitHub Repository settings.

### Manual Override Commands
If you ever need to manually deploy your indexes or rules from the command line:
```bash
# Deploy both Rules & Indexes
npx firebase deploy --only firestore --project=nilamit-52073

# Deploy Indexes only
npx firebase deploy --only firestore:indexes --project=nilamit-52073

# Deploy Rules only
npx firebase deploy --only firestore:rules --project=nilamit-52073
```

## Custom Domain

1. Firebase Console → App Hosting → your backend → Custom domain
2. Add domain (e.g., `nilamit.app`)
3. Add the DNS records from the console to your registrar
4. Wait for SSL provisioning (< 1 hour)
5. Update `AUTH_URL` in Secret Manager to your custom domain
6. Trigger a redeploy

---

## Troubleshooting

**Build fails with missing env errors**
→ Check Secret Manager — all secrets in `apphosting.yaml` must exist before the first deploy. The env validator soft-fails during build but some secrets must exist.

**Cron jobs return 401**
→ `CRON_SECRET` in Secret Manager doesn't match Cloud Scheduler's configured auth token. Re-run `setup-cloud-scheduler.sh`.

**Auth redirect loop**
→ `AUTH_URL` / `NEXTAUTH_URL` doesn't match the actual deployment domain exactly (including `https://`).

**Cold start latency**
→ Set `minInstances: 1` in `apphosting.yaml` and push to redeploy.

**"Firebase Admin — Missing credentials" error**
→ The service account credentials are not properly set in Secret Manager, or the Cloud Run service account doesn't have `secretmanager.secretAccessor` IAM role.
