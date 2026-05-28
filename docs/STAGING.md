# Staging environment

This doc covers the one-time setup to give nilamit a real staging tier so
PRs can be tested against a production-like backend before merging to
`main` (which auto-deploys to prod).

## What you get

- Separate Firebase project (`nilamit-staging`) — own Firestore, RTDB, Storage, Auth.
- Separate App Hosting backend (also called `nilamit-staging`).
- Separate BigQuery dataset (`nilamit_events_staging`) so staging traffic doesn't poison prod analytics.
- GitHub Actions workflow that deploys every PR to the staging backend and comments the preview URL back.
- Top banner across the app saying "STAGING — not real" so testers can't confuse it with prod (toggled via `NEXT_PUBLIC_IS_STAGING=true` in `apphosting-staging.yaml`).

## One-time setup (~30 min in GCP console + CLI)

### 1. Create the Firebase project

```bash
firebase projects:create nilamit-staging --display-name "Nilamit Staging"
firebase use --add nilamit-staging
```

Enable the same Firebase services as prod: Auth, Firestore, RTDB (asia-southeast1), Storage, Cloud Messaging, App Check.

### 2. Create the App Hosting backend

```bash
firebase apphosting:backends:create nilamit-staging \
  --project nilamit-staging \
  --location asia-southeast1
```

### 3. Clone secrets from prod → staging

These secrets are deployment-shared (same NextAuth secret, same Resend API key — you don't want PR previews mailing customers from a different sender, but you DO want isolated Firebase + GCP credentials).

```bash
# Shared secrets (re-use prod values):
for s in AUTH_SECRET RESEND_API_KEY UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN SENTRY_DSN GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ADMIN_EMAILS; do
  PRODVAL=$(firebase apphosting:secrets:access "$s" --project nilamit-52073)
  printf '%s' "$PRODVAL" | firebase apphosting:secrets:set "$s" \
    --project nilamit-staging --data-file -
  firebase apphosting:secrets:grantaccess "$s" \
    --project nilamit-staging --backend nilamit-staging
done

# Staging-specific (NEW values from nilamit-staging Firebase project):
# Go to Firebase Console → nilamit-staging → Project Settings, copy values,
# then set them with firebase apphosting:secrets:set for:
#   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
#   FIREBASE_DATABASE_URL, FIREBASE_STORAGE_BUCKET, FIREBASE_WEB_API_KEY,
#   FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, APP_URL, CRON_SECRET
```

### 4. Mirror Firestore rules + indexes

```bash
firebase deploy --only firestore --project nilamit-staging
firebase deploy --only storage --project nilamit-staging
firebase deploy --only database --project nilamit-staging
```

### 5. Create the BigQuery dataset

```bash
bq --project_id=nilamit-staging --location=asia-southeast1 mk \
  --dataset --description="Staging analytics events" nilamit_events_staging

# Create the events table with the same schema as prod (see CLAUDE.md):
bq --project_id=nilamit-staging mk --table \
  --time_partitioning_field=ts --time_partitioning_type=DAY \
  --clustering_fields=event_type,user_id \
  nilamit_events_staging.events \
  /tmp/events-schema.json  # use the schema doc'd in CLAUDE.md
```

### 6. Set up GitHub Actions auth (Workload Identity)

Create a service account in `nilamit-staging` with `roles/firebaseapphosting.developer`:

```bash
gcloud iam service-accounts create github-deployer \
  --project=nilamit-staging
gcloud projects add-iam-policy-binding nilamit-staging \
  --member="serviceAccount:github-deployer@nilamit-staging.iam.gserviceaccount.com" \
  --role="roles/firebaseapphosting.developer"

# Workload Identity binding (replace REPO_ID + ORG/REPO):
gcloud iam workload-identity-pools create github \
  --project=nilamit-staging --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --project=nilamit-staging --location=global \
  --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"
gcloud iam service-accounts add-iam-policy-binding \
  github-deployer@nilamit-staging.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/Sayem9999/nilamit.com"
```

Then add these GitHub repo secrets:
- `GCP_WIF_PROVIDER_STAGING` = `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github`
- `GCP_SA_STAGING` = `github-deployer@nilamit-staging.iam.gserviceaccount.com`

### 7. Open a test PR

The workflow at `.github/workflows/staging-deploy.yml` should fire automatically on PR open. The first run installs deps + builds + deploys; you should see a comment with the staging URL within ~6 minutes.

## What's NOT mirrored (intentional)

- **Production payment credentials** (SSLCommerz, bKash, Nagad). Staging should never charge a real card. Either leave the secrets unset (gateway returns 503) or use vendor sandbox creds (`SSLCOMMERZ_SANDBOX=true`).
- **Production Algolia index** — staging has no search backend wired (Firestore-only fallback works fine for QA).
- **Twilio WhatsApp / SMS credentials** — staging can't send real messages to real numbers. Leave unset.

## Operations

- **Promote staging build → prod**: merge the PR. The `main`-branch auto-deploy in `apphosting.yaml` takes over.
- **Roll back prod**: `firebase apphosting:rollouts:list nilamit --project nilamit-52073` then `firebase apphosting:rollouts:create nilamit --project nilamit-52073 --build BUILD_ID`.
- **Smoke test staging**: `curl https://nilamit-staging--nilamit-staging.asia-southeast1.hosted.app/api/health` — should return `{"status":"ok"}`.
