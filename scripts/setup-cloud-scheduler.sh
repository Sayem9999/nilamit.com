#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Nilamit — Google Cloud Scheduler Setup
# ═══════════════════════════════════════════════════════════════
#
# USAGE:
#   1. Set the two variables below
#   2. chmod +x scripts/setup-cloud-scheduler.sh
#   3. ./scripts/setup-cloud-scheduler.sh
#
# REQUIREMENTS:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Cloud Scheduler API enabled in your project
#   - CRON_SECRET already stored in Secret Manager
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── CONFIGURE THESE TWO VALUES ─────────────────────────────────
PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"          # e.g. nilamit-app
APP_URL="https://YOUR_DOMAIN.web.app"          # e.g. https://nilamit-app.web.app
# ───────────────────────────────────────────────────────────────

REGION="us-central1"           # Cloud Scheduler region

echo "Fetching CRON_SECRET from Secret Manager..."
CRON_SECRET=$(gcloud secrets versions access latest \
  --secret="CRON_SECRET" \
  --project="$PROJECT_ID" 2>/dev/null || echo "")

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET not found in Secret Manager."
  echo "  Create it: echo -n 'your-secret' | gcloud secrets create CRON_SECRET --data-file=- --project=$PROJECT_ID"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $CRON_SECRET"

echo "Creating Cloud Scheduler jobs for project: $PROJECT_ID"
echo "  App URL: $APP_URL"
echo ""

# ── Helper: create or update a single job ──────────────────────
# All cron endpoints are POST (not GET) — they mutate state and must not be
# cached or replayed by HTTP intermediaries.
create_or_update_job() {
  local JOB_NAME="$1"
  local SCHEDULE="$2"
  local ENDPOINT="$3"
  local DESCRIPTION="$4"

  local URL="$APP_URL$ENDPOINT"
  echo "  → $JOB_NAME ($SCHEDULE)"

  if gcloud scheduler jobs describe "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$REGION" &>/dev/null; then

    gcloud scheduler jobs update http "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --schedule="$SCHEDULE" \
      --uri="$URL" \
      --http-method=POST \
      --headers="$AUTH_HEADER" \
      --time-zone="Asia/Dhaka" \
      --attempt-deadline=60s \
      --description="$DESCRIPTION" \
      --quiet
    echo "    Updated"
  else
    gcloud scheduler jobs create http "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --schedule="$SCHEDULE" \
      --uri="$URL" \
      --http-method=POST \
      --headers="$AUTH_HEADER" \
      --time-zone="Asia/Dhaka" \
      --attempt-deadline=60s \
      --description="$DESCRIPTION" \
      --quiet
    echo "    Created"
  fi
}

# ── Jobs ────────────────────────────────────────────────────────
#
# NOTE: nilamit-close-auctions and nilamit-process-auctions both call
# closeAllEndedAuctions() — they are identical. Run only ONE per minute.
# nilamit-close-auctions is the canonical job; nilamit-process-auctions
# exists for backwards compatibility with older scheduler configs.
# If you are setting up fresh, disable nilamit-process-auctions below.

create_or_update_job \
  "nilamit-close-auctions" \
  "* * * * *" \
  "/api/cron/close-auctions" \
  "Close expired ACTIVE auctions — mark SOLD or EXPIRED, create escrow"

# Remove or comment out the line below if nilamit-close-auctions is already running.
create_or_update_job \
  "nilamit-process-auctions" \
  "* * * * *" \
  "/api/cron/process-auctions" \
  "Alias for close-auctions (backwards compat — disable if close-auctions is active)"

create_or_update_job \
  "nilamit-closing-soon" \
  "*/15 * * * *" \
  "/api/cron/closing-soon" \
  "Send ending-soon notifications for auctions closing in the next hour"

create_or_update_job \
  "nilamit-process-alerts" \
  "*/2 * * * *" \
  "/api/cron/process-alerts" \
  "Fire price-drop and target-reached alerts"

echo ""
echo "All Cloud Scheduler jobs configured."
echo ""
echo "Verify: https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID"
echo ""
echo "Test a job manually:"
echo "  gcloud scheduler jobs run nilamit-close-auctions --project=$PROJECT_ID --location=$REGION"
