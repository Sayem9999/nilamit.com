#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# fix-build.sh — Fix IAM permissions and missing secrets,
# then trigger a fresh Firebase App Hosting deploy.
#
# Run this when you see:
#   "Misconfigured Secret / IAM_PERMISSION_DENIED" in Cloud Build
#
# Usage:
#   chmod +x scripts/fix-build.sh
#   ./scripts/fix-build.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ID="nilamit-52073"
PROJECT_NUMBER="884637735592"
REGION="asia-southeast1"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "\n${RED}✗ $*${NC}\n"; exit 1; }
step() { echo -e "\n${BOLD}▶ $*${NC}"; }

command -v gcloud &>/dev/null || fail "gcloud CLI not found. Install from https://cloud.google.com/sdk"
gcloud config set project "$PROJECT_ID" --quiet

# ── 1. GRANT IAM TO ALL RELEVANT SERVICE ACCOUNTS ──────────────

step "Granting secretmanager.secretAccessor to all service accounts"

grant_secret_access() {
  local SA="$1"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None \
    --quiet 2>/dev/null \
    && ok "Granted: $SA" \
    || warn "Could not grant (may already exist): $SA"
}

# Firebase App Hosting build SA (the one that was missing)
grant_secret_access "service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com"

# Cloud Build SA
grant_secret_access "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Cloud Run compute SA (runtime secret access)
grant_secret_access "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Firebase Admin SA (if it exists)
FB_ADMIN_SA=$(gcloud iam service-accounts list \
  --project="$PROJECT_ID" \
  --filter="email:firebase-adminsdk" \
  --format="value(email)" 2>/dev/null | head -1 || echo "")
[[ -n "$FB_ADMIN_SA" ]] && grant_secret_access "$FB_ADMIN_SA"

# ── 2. CHECK ALL REQUIRED SECRETS EXIST ─────────────────────────

step "Checking required secrets exist in Secret Manager"

REQUIRED_SECRETS=(
  AUTH_SECRET
  ADMIN_EMAILS
  CRON_SECRET
  FIREBASE_PROJECT_ID
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY
  FIREBASE_DATABASE_URL
  FIREBASE_STORAGE_BUCKET
  FIREBASE_WEB_API_KEY
  FIREBASE_MESSAGING_SENDER_ID
  FIREBASE_APP_ID
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  SENTRY_DSN
)

MISSING=()
for SECRET in "${REQUIRED_SECRETS[@]}"; do
  if gcloud secrets describe "$SECRET" --project="$PROJECT_ID" &>/dev/null; then
    ok "$SECRET"
  else
    warn "MISSING: $SECRET"
    MISSING+=("$SECRET")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${YELLOW}${BOLD}Missing secrets must be created before the build can succeed.${NC}"
  echo -e "  Run ${BOLD}scripts/deploy.sh${NC} to create them automatically, or create each manually:"
  echo ""
  for S in "${MISSING[@]}"; do
    echo -e "    echo -n 'VALUE' | gcloud secrets create $S --data-file=- --project=$PROJECT_ID"
  done
  echo ""
  echo -e "  ${BOLD}Continue anyway to retry the build? (y/N)${NC} "
  read -r REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || exit 0
fi

# ── 3. TRIGGER A FRESH DEPLOY ────────────────────────────────────

step "Triggering a fresh deploy by pushing an empty commit"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd .. && pwd)"
cd "$REPO_ROOT"

git commit --allow-empty -m "chore: trigger redeploy after IAM fix"
git push origin main

echo ""
echo -e "${BOLD}${GREEN}Done.${NC} Build triggered."
echo -e "  Watch: https://console.firebase.google.com/project/${PROJECT_ID}/apphosting"
echo -e "  Logs:  https://console.cloud.google.com/cloud-build/builds;region=${REGION}?project=${PROJECT_ID}"
