#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Nilamit — Google Cloud Scheduler Setup
# Replaces Vercel Cron jobs for Firebase App Hosting deployment
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
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── CONFIGURE THESE TWO VALUES ─────────────────────────────────
PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"          # e.g. nilamit-app
APP_URL="https://YOUR_DOMAIN.web.app"          # e.g. https://nilamit-app.web.app
# ───────────────────────────────────────────────────────────────

REGION="us-central1"           # Cloud Scheduler region
SERVICE_ACCOUNT=""             # Leave empty to use default compute SA

echo "🔑 Fetching CRON_SECRET from Secret Manager..."
CRON_SECRET=$(gcloud secrets versions access latest \
  --secret="CRON_SECRET" \
  --project="$PROJECT_ID" 2>/dev/null || echo "")

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET not found in Secret Manager."
  echo "   Create it first: echo -n 'your-secret' | gcloud secrets create CRON_SECRET --data-file=- --project=$PROJECT_ID"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $CRON_SECRET"

echo "📅 Creating Cloud Scheduler jobs for project: $PROJECT_ID"
echo "   App URL: $APP_URL"
echo ""

# ── Helper function ─────────────────────────────────────────────
create_or_update_job() {
  local JOB_NAME="$1"
  local SCHEDULE="$2"
  local PATH="$3"
  local DESCRIPTION="$4"

  local URL="$APP_URL$PATH"

  echo "  → $JOB_NAME ($SCHEDULE)"

  # Try to update; create if it doesn't exist
  if gcloud scheduler jobs describe "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$REGION" &>/dev/null; then

    gcloud scheduler jobs update http "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --schedule="$SCHEDULE" \
      --uri="$URL" \
      --http-method=GET \
      --headers="$AUTH_HEADER" \
      --time-zone="Asia/Dhaka" \
      --attempt-deadline=60s \
      --description="$DESCRIPTION" \
      --quiet

    echo "    ✅ Updated"
  else
    gcloud scheduler jobs create http "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --schedule="$SCHEDULE" \
      --uri="$URL" \
      --http-method=GET \
      --headers="$AUTH_HEADER" \
      --time-zone="Asia/Dhaka" \
      --attempt-deadline=60s \
      --description="$DESCRIPTION" \
      --quiet

    echo "    ✅ Created"
  fi
}

# ── Create all 4 cron jobs ──────────────────────────────────────
create_or_update_job \
  "nilamit-process-auctions" \
  "* * * * *" \
  "/api/cron/process-auctions" \
  "Close expired auctions and create escrow transactions"

create_or_update_job \
  "nilamit-close-auctions" \
  "* * * * *" \
  "/api/cron/close-auctions" \
  "Secondary auction closing check via auction-logic"

create_or_update_job \
  "nilamit-closing-soon" \
  "*/15 * * * *" \
  "/api/cron/closing-soon" \
  "Notify watchers about auctions ending in the next hour"

create_or_update_job \
  "nilamit-process-alerts" \
  "*/2 * * * *" \
  "/api/cron/process-alerts" \
  "Trigger price-drop and target-reached alerts"

echo ""
echo "🎉 All Cloud Scheduler jobs created!"
echo ""
echo "📋 Verify in the console:"
echo "   https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID"
echo ""
echo "💡 To run a job immediately (for testing):"
echo "   gcloud scheduler jobs run nilamit-process-auctions --project=$PROJECT_ID --location=$REGION"
