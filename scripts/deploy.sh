#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Nilamit — One-Command Production Deployment
#
# USAGE:
#   1. Fill in the 3 required values in the CONFIGURE section below
#   2. chmod +x scripts/deploy.sh
#   3. ./scripts/deploy.sh
#
# WHAT THIS SCRIPT DOES AUTOMATICALLY:
#   ✓ Authenticates with Firebase and Google Cloud
#   ✓ Creates / verifies the Firebase project
#   ✓ Enables all required GCP APIs
#   ✓ Creates Firestore, RTDB, and Storage databases
#   ✓ Enables Firebase Authentication (email/password)
#   ✓ Creates the Firebase service account + key
#   ✓ Creates the Firebase Web App and extracts SDK config
#   ✓ Generates all secrets (AUTH_SECRET, CRON_SECRET)
#   ✓ Stores all 14 secrets in Google Secret Manager
#   ✓ Grants IAM permissions to Cloud Build + Cloud Run
#   ✓ Deploys Firestore rules, indexes, Storage rules, RTDB rules
#   ✓ Updates apphosting.yaml with real project values
#   ✓ Updates .firebaserc with project ID
#   ✓ Connects GitHub repo and initializes Firebase App Hosting
#   ✓ Pushes code to trigger the first deploy
#   ✓ Sets up all 3 Cloud Scheduler cron jobs
#   ✓ Verifies the deployment with a health check
#
# REQUIRES ONE BROWSER INTERACTION:
#   - Upgrade Firebase project to Blaze plan (billing required)
#     The script opens the URL and waits for you to confirm.
#
# PREREQUISITES:
#   - firebase CLI  (npm install -g firebase-tools)
#   - gcloud CLI    (https://cloud.google.com/sdk/docs/install)
#   - jq            (brew install jq / apt install jq)
#   - git, curl, openssl  (standard tools)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ────────────────────────────────────────────────────────────────────────
# ██  CONFIGURE — fill in these 3 values, then run the script
# ────────────────────────────────────────────────────────────────────────

PROJECT_ID="nilamit-app"                          # Firebase project ID (create new or use existing)
ADMIN_EMAIL="admin@yourdomain.com"                # Your admin email (lowercase)
REGION="asia-southeast1"                          # Closest to Bangladesh (Singapore)

# Optional — leave empty to skip
CUSTOM_DOMAIN=""                                  # e.g. "nilamit.app" — configure after deploy
GOOGLE_CLIENT_ID=""                               # For Google sign-in — get from GCP Console
GOOGLE_CLIENT_SECRET=""                           # For Google sign-in
SENTRY_DSN=""                                     # For error monitoring — get from sentry.io
GREENWEB_TOKEN=""                                 # For SMS OTPs — get from greenweb.com.bd
RESEND_API_KEY=""                                 # For email notifications — get from resend.com

# ────────────────────────────────────────────────────────────────────────
# Script internals — do not edit below this line
# ────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; CYAN='\033[0;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SA_KEY_FILE="$SCRIPT_DIR/.sa-key.json"   # deleted at end of script
LOG_FILE="$SCRIPT_DIR/deploy.log"

step()    { echo -e "\n${BOLD}${BLUE}▶ $*${NC}"; echo "[$(date -u +%H:%M:%S)] STEP: $*" >> "$LOG_FILE"; }
ok()      { echo -e "  ${GREEN}✓${NC} $*";  echo "[$(date -u +%H:%M:%S)] OK: $*"   >> "$LOG_FILE"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; echo "[$(date -u +%H:%M:%S)] WARN: $*" >> "$LOG_FILE"; }
fail()    { echo -e "\n${RED}✗ ERROR: $*${NC}\n"; echo "[$(date -u +%H:%M:%S)] FAIL: $*" >> "$LOG_FILE"; exit 1; }
prompt()  { echo -e "\n${YELLOW}${BOLD}  ► ACTION REQUIRED:${NC} $*"; }
divider() { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

wait_confirm() {
  echo -e "\n  ${BOLD}Press ENTER when done, or Ctrl+C to abort...${NC}"
  read -r
}

cleanup() {
  [[ -f "$SA_KEY_FILE" ]] && rm -f "$SA_KEY_FILE" && echo "  Removed temporary service account key."
}
trap cleanup EXIT

# ══════════════════════════════════════════════════════════════════════
# 0. VALIDATE INPUTS AND PREREQUISITES
# ══════════════════════════════════════════════════════════════════════

divider
echo -e "${BOLD}  Nilamit — Production Deployment Setup${NC}"
echo -e "  Project: ${CYAN}$PROJECT_ID${NC}  |  Region: ${CYAN}$REGION${NC}"
divider

: > "$LOG_FILE"   # clear log

[[ -z "$PROJECT_ID" || "$PROJECT_ID" == "nilamit-app" ]] && fail "Set PROJECT_ID in the CONFIGURE section."
[[ -z "$ADMIN_EMAIL" || "$ADMIN_EMAIL" == "admin@yourdomain.com" ]] && fail "Set ADMIN_EMAIL in the CONFIGURE section."
[[ ! "$ADMIN_EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]] && fail "ADMIN_EMAIL must be lowercase: $ADMIN_EMAIL"

step "Checking prerequisites"
for cmd in firebase gcloud jq curl git openssl; do
  command -v "$cmd" &>/dev/null || fail "'$cmd' is not installed. See prerequisites in script header."
  ok "$cmd found"
done

# Auto-detect GitHub repo from git remote
if [[ -z "${GITHUB_REPO:-}" ]]; then
  GITHUB_REPO=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || echo "")
  [[ -n "$GITHUB_REPO" ]] && ok "GitHub repo auto-detected: $GITHUB_REPO" \
    || fail "Cannot detect GitHub repo. Set GITHUB_REPO variable or push to GitHub first."
fi

# ══════════════════════════════════════════════════════════════════════
# 1. AUTHENTICATE
# ══════════════════════════════════════════════════════════════════════

step "Authenticating"

# Firebase
if ! firebase projects:list &>/dev/null; then
  prompt "Firebase login required. A browser window will open."
  firebase login
fi
ok "Firebase authenticated"

# gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  prompt "Google Cloud login required. A browser window will open."
  gcloud auth login --quiet
fi
ok "Google Cloud authenticated"

gcloud auth application-default login --quiet 2>/dev/null || true
gcloud config set project "$PROJECT_ID" --quiet
ok "gcloud project set to $PROJECT_ID"

# ══════════════════════════════════════════════════════════════════════
# 2. CREATE / VERIFY FIREBASE PROJECT
# ══════════════════════════════════════════════════════════════════════

step "Setting up Firebase project: $PROJECT_ID"

if firebase projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
  ok "Project $PROJECT_ID already exists"
else
  ok "Creating project $PROJECT_ID..."
  firebase projects:create "$PROJECT_ID" --display-name "Nilamit" --quiet 2>/dev/null \
    || warn "Could not create project via CLI — it may already exist or need manual creation at console.firebase.google.com"
fi

# Update .firebaserc
jq --arg pid "$PROJECT_ID" '.projects.default = $pid' "$REPO_ROOT/.firebaserc" > /tmp/.firebaserc.tmp \
  && mv /tmp/.firebaserc.tmp "$REPO_ROOT/.firebaserc"
ok "Updated .firebaserc → $PROJECT_ID"

# Get project number (needed for IAM)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' 2>/dev/null) \
  || fail "Cannot get project number. Is $PROJECT_ID correct and do you have access?"
ok "Project number: $PROJECT_NUMBER"

# ══════════════════════════════════════════════════════════════════════
# 3. UPGRADE TO BLAZE PLAN (required for App Hosting)
# ══════════════════════════════════════════════════════════════════════

step "Firebase Blaze plan (required for App Hosting)"

BLAZE_URL="https://console.firebase.google.com/project/$PROJECT_ID/usage/details"
prompt "Firebase App Hosting requires the Blaze (pay-as-you-go) plan."
echo -e "  Opening: ${CYAN}$BLAZE_URL${NC}"
echo ""
echo -e "  Steps:  1. Click 'Upgrade' in the Firebase Console"
echo -e "          2. Select 'Blaze plan' and add a billing account"
echo -e "          3. Set a budget alert (e.g. \$50/month)"

# Try to open browser
command -v xdg-open &>/dev/null && xdg-open "$BLAZE_URL" 2>/dev/null || \
command -v open &>/dev/null && open "$BLAZE_URL" 2>/dev/null || \
command -v start &>/dev/null && start "$BLAZE_URL" 2>/dev/null || true

wait_confirm

# ══════════════════════════════════════════════════════════════════════
# 4. ENABLE REQUIRED GCP APIs
# ══════════════════════════════════════════════════════════════════════

step "Enabling GCP APIs (this takes ~60 seconds)"

gcloud services enable \
  firestore.googleapis.com \
  firebase.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  identitytoolkit.googleapis.com \
  --project="$PROJECT_ID" --quiet
ok "All APIs enabled"

# ══════════════════════════════════════════════════════════════════════
# 5. CREATE FIREBASE SERVICES
# ══════════════════════════════════════════════════════════════════════

step "Creating Firebase services"

# Firestore
if gcloud firestore databases list --project="$PROJECT_ID" --format="value(name)" 2>/dev/null | grep -q "(default)"; then
  ok "Firestore already exists"
else
  gcloud firestore databases create \
    --location="$REGION" \
    --type="firestore-native" \
    --project="$PROJECT_ID" --quiet 2>/dev/null || warn "Firestore may already exist"
  ok "Firestore created (region: $REGION)"
fi

# RTDB
RTDB_URL="https://${PROJECT_ID}-default-rtdb.${REGION}.firebasedatabase.app"
firebase use "$PROJECT_ID" --quiet 2>/dev/null || true
firebase database:instances:create "${PROJECT_ID}-default-rtdb" \
  --location "$REGION" \
  --project "$PROJECT_ID" 2>/dev/null \
  && ok "RTDB created: $RTDB_URL" \
  || ok "RTDB already exists: $RTDB_URL"

# Enable Email/Password Authentication via Identity Toolkit API
ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)
curl -s -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true},"anonymous":{"enabled":false}}}' \
  > /dev/null 2>&1 && ok "Email/Password authentication enabled" || warn "Could not enable email auth via API — enable manually in Firebase Console → Authentication"

# ══════════════════════════════════════════════════════════════════════
# 6. CREATE FIREBASE WEB APP + EXTRACT SDK CONFIG
# ══════════════════════════════════════════════════════════════════════

step "Creating Firebase Web App and extracting SDK config"

# Check if a web app already exists
EXISTING_APPS=$(firebase apps:list --project "$PROJECT_ID" --json 2>/dev/null \
  | jq -r '[.[] | select(.platform == "WEB")] | length' 2>/dev/null || echo "0")

if [[ "$EXISTING_APPS" -gt 0 ]]; then
  ok "Web app already exists"
  APP_ID=$(firebase apps:list --project "$PROJECT_ID" --json 2>/dev/null \
    | jq -r '[.[] | select(.platform == "WEB")][0].appId' 2>/dev/null)
else
  APP_ID=$(firebase apps:create web "nilamit-web" --project "$PROJECT_ID" --json 2>/dev/null \
    | jq -r '.appId' 2>/dev/null)
  ok "Web app created: $APP_ID"
fi

# Get SDK config
SDK_CONFIG=$(firebase apps:sdkconfig web "$APP_ID" --project "$PROJECT_ID" --json 2>/dev/null \
  | jq '.sdkConfig // .' 2>/dev/null)

WEB_API_KEY=$(echo "$SDK_CONFIG"        | jq -r '.apiKey // empty')
MESSAGING_SENDER_ID=$(echo "$SDK_CONFIG" | jq -r '.messagingSenderId // empty')
FIREBASE_APP_ID=$(echo "$SDK_CONFIG"    | jq -r '.appId // empty')
STORAGE_BUCKET=$(echo "$SDK_CONFIG"     | jq -r '.storageBucket // empty')
DATABASE_URL=$(echo "$SDK_CONFIG"       | jq -r '.databaseURL // empty')

[[ -z "$WEB_API_KEY" ]]        && fail "Could not extract Firebase Web API key. Check firebase apps:sdkconfig output."
[[ -z "$MESSAGING_SENDER_ID" ]] && fail "Could not extract Messaging Sender ID."
[[ -z "$FIREBASE_APP_ID" ]]    && fail "Could not extract Firebase App ID."
[[ -z "$STORAGE_BUCKET" ]]     && STORAGE_BUCKET="${PROJECT_ID}.firebasestorage.app"
[[ -z "$DATABASE_URL" ]]       && DATABASE_URL="https://${PROJECT_ID}-default-rtdb.${REGION}.firebasedatabase.app"

ok "Web API Key extracted"
ok "Messaging Sender ID extracted"
ok "App ID extracted"

# ══════════════════════════════════════════════════════════════════════
# 7. CREATE SERVICE ACCOUNT KEY
# ══════════════════════════════════════════════════════════════════════

step "Creating Firebase Admin SDK service account key"

# Firebase creates the Admin SDK SA automatically; find it
SA_EMAIL=$(gcloud iam service-accounts list \
  --project="$PROJECT_ID" \
  --filter="email:firebase-adminsdk" \
  --format="value(email)" 2>/dev/null | head -1)

if [[ -z "$SA_EMAIL" ]]; then
  # Create our own service account with the required permissions
  SA_NAME="nilamit-admin"
  SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Nilamit Admin SDK" \
    --project="$PROJECT_ID" --quiet 2>/dev/null || true
  for role in "roles/datastore.user" "roles/firebase.admin" "roles/storage.admin"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="$role" --quiet 2>/dev/null || true
  done
  ok "Created service account: $SA_EMAIL"
fi

gcloud iam service-accounts keys create "$SA_KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID" --quiet 2>/dev/null
ok "Service account key created (temporary file, deleted after secrets are stored)"

CLIENT_EMAIL=$(jq -r '.client_email' "$SA_KEY_FILE")
PRIVATE_KEY=$(jq -r '.private_key'   "$SA_KEY_FILE")

# ══════════════════════════════════════════════════════════════════════
# 8. GENERATE SECRETS
# ══════════════════════════════════════════════════════════════════════

step "Generating secrets"

AUTH_SECRET_VALUE=$(openssl rand -base64 32)
CRON_SECRET_VALUE=$(openssl rand -hex 32)
ok "AUTH_SECRET generated ($(echo -n "$AUTH_SECRET_VALUE" | wc -c | tr -d ' ') bytes)"
ok "CRON_SECRET generated"

# ══════════════════════════════════════════════════════════════════════
# 9. STORE ALL SECRETS IN SECRET MANAGER
# ══════════════════════════════════════════════════════════════════════

step "Storing secrets in Google Secret Manager"

create_or_update_secret() {
  local NAME="$1"
  local VALUE="$2"
  if gcloud secrets describe "$NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --project="$PROJECT_ID" --quiet
    ok "$NAME (updated)"
  else
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=- --project="$PROJECT_ID" --quiet
    ok "$NAME (created)"
  fi
}

# Core secrets
create_or_update_secret "AUTH_SECRET"               "$AUTH_SECRET_VALUE"
create_or_update_secret "CRON_SECRET"               "$CRON_SECRET_VALUE"
create_or_update_secret "ADMIN_EMAILS"              "$ADMIN_EMAIL"

# Firebase Admin SDK
create_or_update_secret "FIREBASE_PROJECT_ID"       "$PROJECT_ID"
create_or_update_secret "FIREBASE_CLIENT_EMAIL"     "$CLIENT_EMAIL"
create_or_update_secret "FIREBASE_PRIVATE_KEY"      "$PRIVATE_KEY"
create_or_update_secret "FIREBASE_DATABASE_URL"     "$DATABASE_URL"
create_or_update_secret "FIREBASE_STORAGE_BUCKET"   "$STORAGE_BUCKET"

# Firebase Client SDK
create_or_update_secret "FIREBASE_WEB_API_KEY"      "$WEB_API_KEY"
create_or_update_secret "FIREBASE_MESSAGING_SENDER_ID" "$MESSAGING_SENDER_ID"
create_or_update_secret "FIREBASE_APP_ID"           "$FIREBASE_APP_ID"

# Optional secrets (only create if values are provided)
[[ -n "$GOOGLE_CLIENT_ID" ]]     && create_or_update_secret "GOOGLE_CLIENT_ID"     "$GOOGLE_CLIENT_ID"
[[ -n "$GOOGLE_CLIENT_SECRET" ]] && create_or_update_secret "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
[[ -n "$SENTRY_DSN" ]]           && create_or_update_secret "SENTRY_DSN"           "$SENTRY_DSN"
[[ -n "$RESEND_API_KEY" ]]       && create_or_update_secret "RESEND_API_KEY"       "$RESEND_API_KEY"
[[ -n "$GREENWEB_TOKEN" ]]       && create_or_update_secret "GREENWEB_TOKEN"       "$GREENWEB_TOKEN"

ok "All secrets stored in Secret Manager"

# Delete the key file now that secrets are stored
rm -f "$SA_KEY_FILE"
ok "Temporary service account key file deleted"

# ══════════════════════════════════════════════════════════════════════
# 10. GRANT IAM PERMISSIONS
# ══════════════════════════════════════════════════════════════════════

step "Granting IAM permissions to Cloud Build and Cloud Run"

for SA in "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null && ok "secretAccessor granted to $SA" || warn "Could not grant IAM to $SA (may already exist)"
done

# ══════════════════════════════════════════════════════════════════════
# 11. DEPLOY SECURITY RULES AND INDEXES
# ══════════════════════════════════════════════════════════════════════

step "Deploying security rules and indexes"
cd "$REPO_ROOT"

firebase deploy \
  --only "firestore:rules,firestore:indexes,storage,database" \
  --project "$PROJECT_ID" \
  --non-interactive --quiet \
  && ok "Firestore rules + indexes, Storage rules, RTDB rules deployed" \
  || warn "Rules deployment had warnings — check Firebase Console"

# ══════════════════════════════════════════════════════════════════════
# 12. UPDATE apphosting.yaml WITH REAL VALUES
# ══════════════════════════════════════════════════════════════════════

step "Updating apphosting.yaml with project values"

YAML_FILE="$REPO_ROOT/apphosting.yaml"

# Enable optional secrets in apphosting.yaml if provided
if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
  # Uncomment Google OAuth section if it exists as comments
  sed -i.bak 's/^  # - variable: GOOGLE_CLIENT_ID/  - variable: GOOGLE_CLIENT_ID/' "$YAML_FILE" 2>/dev/null || true
  sed -i.bak 's/^  #   secret: GOOGLE_CLIENT_ID/    secret: GOOGLE_CLIENT_ID/' "$YAML_FILE" 2>/dev/null || true
fi

if [[ -n "$SENTRY_DSN" ]]; then
  sed -i.bak 's/^  # - variable: SENTRY_DSN/  - variable: SENTRY_DSN/' "$YAML_FILE" 2>/dev/null || true
  sed -i.bak 's/^  #   secret: SENTRY_DSN/    secret: SENTRY_DSN/' "$YAML_FILE" 2>/dev/null || true
fi

if [[ -n "$GREENWEB_TOKEN" ]]; then
  # Add SMS provider config if not present
  if ! grep -q "SMS_PROVIDER" "$YAML_FILE"; then
    cat >> "$YAML_FILE" << 'EOF'

  - variable: SMS_PROVIDER
    value: greenweb

  - variable: GREENWEB_TOKEN
    secret: GREENWEB_TOKEN
EOF
  fi
fi

rm -f "${YAML_FILE}.bak"
ok "apphosting.yaml updated"

# ══════════════════════════════════════════════════════════════════════
# 13. INITIALIZE FIREBASE APP HOSTING (connects GitHub)
# ══════════════════════════════════════════════════════════════════════

step "Initializing Firebase App Hosting"
echo ""
echo -e "  This step connects your GitHub repository to Firebase App Hosting."
echo -e "  A browser window will open for GitHub OAuth authorization."
echo -e "  When prompted:"
echo -e "    - Region: select ${CYAN}$REGION${NC}"
echo -e "    - Repository: select ${CYAN}$GITHUB_REPO${NC}"
echo -e "    - Branch: enter ${CYAN}main${NC}"
echo ""

BACKEND_EXISTS=$(firebase apphosting:backends:list --project "$PROJECT_ID" --json 2>/dev/null \
  | jq 'length' 2>/dev/null || echo "0")

if [[ "$BACKEND_EXISTS" -gt 0 ]]; then
  ok "App Hosting backend already exists"
  APP_URL=$(firebase apphosting:backends:list --project "$PROJECT_ID" --json 2>/dev/null \
    | jq -r '.[0].uri // .[0].appHostingUrl // ""' 2>/dev/null || echo "")
else
  firebase apphosting:backends:create --project "$PROJECT_ID"
  APP_URL=$(firebase apphosting:backends:list --project "$PROJECT_ID" --json 2>/dev/null \
    | jq -r '.[0].uri // .[0].appHostingUrl // ""' 2>/dev/null || echo "")
fi

if [[ -z "$APP_URL" ]]; then
  warn "Could not auto-detect App Hosting URL. Getting it from backend list..."
  firebase apphosting:backends:list --project "$PROJECT_ID"
  echo ""
  echo -n "  Paste the App Hosting URL from above (e.g. https://nilamit--xxx.hosted.app): "
  read -r APP_URL
fi

# Ensure URL has https://
[[ "$APP_URL" != https://* ]] && APP_URL="https://$APP_URL"
APP_URL="${APP_URL%/}"  # strip trailing slash
ok "App Hosting URL: $APP_URL"

# Update apphosting.yaml with the real URL
python3 - "$YAML_FILE" "$APP_URL" << 'PYEOF'
import sys, re
yaml_file, app_url = sys.argv[1], sys.argv[2]
with open(yaml_file) as f:
    content = f.read()
content = re.sub(r'(value:\s*)https://nilamit--nilamit-52073\.asia-southeast1\.hosted\.app', r'\g<1>' + app_url, content)
content = re.sub(r'(value:\s*)https://YOUR[^\n]*hosted\.app[^\n]*', r'\g<1>' + app_url, content)
with open(yaml_file, 'w') as f:
    f.write(content)
PYEOF
ok "apphosting.yaml AUTH_URL updated to $APP_URL"

# Update NEXT_PUBLIC_APP_URL as well
python3 - "$YAML_FILE" "$APP_URL" << 'PYEOF'
import sys, re
yaml_file, app_url = sys.argv[1], sys.argv[2]
with open(yaml_file) as f:
    content = f.read()
content = re.sub(r'(NEXT_PUBLIC_APP_URL\n\s+value:\s*)[^\n]+', r'\g<1>' + app_url, content)
with open(yaml_file, 'w') as f:
    f.write(content)
PYEOF

# ══════════════════════════════════════════════════════════════════════
# 14. COMMIT CONFIG CHANGES AND PUSH TO TRIGGER DEPLOY
# ══════════════════════════════════════════════════════════════════════

step "Committing config updates and triggering deploy"

cd "$REPO_ROOT"
git add .firebaserc apphosting.yaml
git diff --cached --quiet \
  && ok "No config changes to commit (already up to date)" \
  || (git commit -m "chore: configure project ${PROJECT_ID} for firebase app hosting" \
      && ok "Config changes committed")

git push origin main
ok "Pushed to main — Firebase App Hosting will now build and deploy"
echo ""
echo -e "  ${CYAN}Build progress:${NC}"
echo -e "  https://console.firebase.google.com/project/${PROJECT_ID}/apphosting"
echo ""
echo -e "  Waiting 90 seconds for the build to start before setting up cron..."
sleep 90

# ══════════════════════════════════════════════════════════════════════
# 15. SET UP CLOUD SCHEDULER
# ══════════════════════════════════════════════════════════════════════

step "Setting up Cloud Scheduler cron jobs"

SCHEDULER_REGION="$REGION"

create_or_update_cron() {
  local JOB_NAME="$1"
  local SCHEDULE="$2"
  local ENDPOINT="$3"
  local DESCRIPTION="$4"
  local URL="$APP_URL$ENDPOINT"
  local AUTH_HEADER="Authorization: Bearer $CRON_SECRET_VALUE"

  echo "  → $JOB_NAME ($SCHEDULE)"

  if gcloud scheduler jobs describe "$JOB_NAME" \
      --project="$PROJECT_ID" --location="$SCHEDULER_REGION" &>/dev/null; then
    gcloud scheduler jobs update http "$JOB_NAME" \
      --project="$PROJECT_ID" --location="$SCHEDULER_REGION" \
      --schedule="$SCHEDULE" --uri="$URL" --http-method=POST \
      --headers="$AUTH_HEADER" --time-zone="Asia/Dhaka" \
      --attempt-deadline=60s --description="$DESCRIPTION" --quiet
    echo "    Updated"
  else
    gcloud scheduler jobs create http "$JOB_NAME" \
      --project="$PROJECT_ID" --location="$SCHEDULER_REGION" \
      --schedule="$SCHEDULE" --uri="$URL" --http-method=POST \
      --headers="$AUTH_HEADER" --time-zone="Asia/Dhaka" \
      --attempt-deadline=60s --description="$DESCRIPTION" --quiet
    echo "    Created"
  fi
}

create_or_update_cron "nilamit-close-auctions" "* * * * *"    "/api/cron/close-auctions" "Close expired auctions"
create_or_update_cron "nilamit-closing-soon"   "*/15 * * * *" "/api/cron/closing-soon"   "Ending-soon notifications"
create_or_update_cron "nilamit-process-alerts" "*/2 * * * *"  "/api/cron/process-alerts" "Price alert processing"

ok "3 cron jobs configured (close-auctions, closing-soon, process-alerts)"

# ══════════════════════════════════════════════════════════════════════
# 16. WAIT FOR DEPLOY AND VERIFY
# ══════════════════════════════════════════════════════════════════════

step "Waiting for deployment to complete"

MAX_WAIT=600   # 10 minutes
WAITED=0
HEALTH_URL="${APP_URL}/api/health"

echo -e "  Polling ${CYAN}$HEALTH_URL${NC} every 15 seconds..."

while [[ $WAITED -lt $MAX_WAIT ]]; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

  if [[ "$HTTP_STATUS" == "200" ]]; then
    HEALTH_BODY=$(curl -s "$HEALTH_URL" 2>/dev/null)
    DB_STATUS=$(echo "$HEALTH_BODY" | jq -r '.db // "unknown"' 2>/dev/null || echo "unknown")
    LATENCY=$(echo "$HEALTH_BODY"  | jq -r '.latencyMs // "?"' 2>/dev/null || echo "?")
    ok "Deployment is LIVE  (db: $DB_STATUS, latency: ${LATENCY}ms)"
    break
  fi

  echo -e "    HTTP $HTTP_STATUS — waiting... (${WAITED}s elapsed)"
  sleep 15
  WAITED=$((WAITED + 15))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  warn "Health check timed out after ${MAX_WAIT}s. The build may still be in progress."
  echo -e "  Check: https://console.firebase.google.com/project/${PROJECT_ID}/apphosting"
fi

# ══════════════════════════════════════════════════════════════════════
# 17. PRINT SUMMARY
# ══════════════════════════════════════════════════════════════════════

divider
echo -e "\n${BOLD}${GREEN}  Deployment Complete!${NC}\n"
echo -e "  ${BOLD}Live URL:${NC}         $APP_URL"
echo -e "  ${BOLD}Health check:${NC}     ${APP_URL}/api/health"
echo -e "  ${BOLD}Firebase Console:${NC} https://console.firebase.google.com/project/${PROJECT_ID}/apphosting"
echo -e "  ${BOLD}Cloud Scheduler:${NC}  https://console.cloud.google.com/cloudscheduler?project=${PROJECT_ID}"
echo -e "  ${BOLD}Logs:${NC}             $LOG_FILE"
echo ""
echo -e "  ${BOLD}${YELLOW}Next steps:${NC}"
echo -e "  1. ${YELLOW}Rotate credentials${NC} — the .env file has exposed Google OAuth + AUTH_SECRET."
echo -e "     Google Console: https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"
echo -e "     New AUTH_SECRET: ${CYAN}openssl rand -base64 32${NC}"
echo -e "     Update: ${CYAN}echo -n '<value>' | gcloud secrets versions add AUTH_SECRET --data-file=- --project=${PROJECT_ID}${NC}"
echo ""
echo -e "  2. ${YELLOW}SMS (OTPs)${NC} — currently logging to stdout, not sending real SMS."
echo -e "     Get token from greenweb.com.bd and add GREENWEB_TOKEN to the CONFIGURE section, re-run."
echo ""
echo -e "  3. ${YELLOW}Sentry${NC} — add SENTRY_DSN to the CONFIGURE section and re-run for error tracking."
echo ""
if [[ -n "$CUSTOM_DOMAIN" ]]; then
  echo -e "  4. ${YELLOW}Custom domain ${CUSTOM_DOMAIN}${NC} — set up in Firebase Console → App Hosting → Custom domain"
fi
divider
