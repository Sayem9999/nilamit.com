#!/usr/bin/env bash
# bootstrap-secrets.sh
#
# Sets the remaining Nilamit secrets in Firebase App Hosting + grants
# the backend access. Pipe credentials in via env vars so they never
# touch your shell history or get logged by ps:
#
#   TWILIO_SID=AC... TWILIO_TOKEN=... TWILIO_FROM='whatsapp:+14155238886' \
#   SSL_STORE_ID=... SSL_STORE_PW=... \
#   ALGOLIA_APP=... ALGOLIA_KEY=... \
#     bash scripts/bootstrap-secrets.sh
#
# Each var is independent — leave the ones you don't have empty and the
# script skips that secret cleanly. Re-run is idempotent.
#
# Already-set secrets (don't re-run unless rotating):
#   AUTH_SECRET, ADMIN_EMAILS, CRON_SECRET, FIREBASE_*, GOOGLE_*, SENTRY_*,
#   UPSTASH_*, RESEND_API_KEY, FIREBASE_WEB_API_KEY, FIREBASE_VAPID_KEY,
#   PAYMENT_WEBHOOK_SECRET (just generated — already in Secret Manager).

set -euo pipefail

PROJECT=nilamit-52073
BACKEND=nilamit

# Idempotent: set + grant for one secret, no-op if value is empty.
# Args: NAME VALUE
set_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  ($name skipped — no value)"
    return
  fi
  echo "  setting $name..."
  printf '%s' "$value" \
    | firebase apphosting:secrets:set "$name" \
        --project "$PROJECT" \
        --data-file - \
        --force >/dev/null
  firebase apphosting:secrets:grantaccess "$name" \
    --project "$PROJECT" \
    --backend "$BACKEND" >/dev/null
  echo "  ✓ $name set + granted to $BACKEND"
}

echo "Bootstrapping Nilamit secrets in project=$PROJECT backend=$BACKEND"
echo ""

# ─── Twilio (WhatsApp Business API) ─────────────────────────────────
# Get TWILIO_SID + TWILIO_TOKEN from https://console.twilio.com.
# TWILIO_FROM is your sandbox WhatsApp number, e.g. "whatsapp:+14155238886".
# Production requires a Meta-approved template — see Twilio docs.
echo "▸ Twilio (WhatsApp Business)"
set_secret "TWILIO_ACCOUNT_SID"   "${TWILIO_SID:-}"
set_secret "TWILIO_AUTH_TOKEN"    "${TWILIO_TOKEN:-}"
set_secret "TWILIO_WHATSAPP_FROM" "${TWILIO_FROM:-}"
echo ""

# ─── SSLCommerz (card / net-banking gateway) ────────────────────────
# Get from https://developer.sslcommerz.com — sandbox creds free + instant.
# Production requires merchant onboarding + trade license.
# The existing /api/payments/callback uses STORE_PASSWORD to verify the
# IPN hash; we don't need a separate STORE_ID secret since the callback
# doesn't initiate the session, just verifies it.
echo "▸ SSLCommerz"
set_secret "SSLCOMMERZ_STORE_ID"       "${SSL_STORE_ID:-}"
set_secret "SSLCOMMERZ_STORE_PASSWORD" "${SSL_STORE_PW:-}"
echo ""

# ─── Algolia (search) ───────────────────────────────────────────────
# Get from https://dashboard.algolia.com/account/api-keys/all
# ALGOLIA_KEY MUST be the *Search-only* key, NOT the Admin key — the
# Admin key has write permissions and must never leave the build env.
echo "▸ Algolia"
set_secret "ALGOLIA_APP_ID"     "${ALGOLIA_APP:-}"
set_secret "ALGOLIA_SEARCH_KEY" "${ALGOLIA_KEY:-}"
echo ""

# ─── Pub/Sub (downstream fan-out — env var, not secret) ─────────────
# PUBSUB_TOPIC_PREFIX is a non-secret config string — set in
# apphosting.yaml as a plain env var, not via this script.
echo "▸ Pub/Sub topic prefix is a non-secret value — edit apphosting.yaml"
echo "  to add: variable: PUBSUB_TOPIC_PREFIX, value: nilamit-prod"
echo ""

echo "Done. Next deploy will pick up the new secrets."
echo "Verify with: gcloud secrets list --project=$PROJECT --format='value(name)'"
