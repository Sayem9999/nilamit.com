#!/usr/bin/env bash
#
# End-to-end production smoke test (read-only / non-destructive).
#
# Verifies the live HTTP surface: public pages, PWA assets + signed APK, OG
# image, health, API auth-gating, and cron security. Exits non-zero on any
# failure so it can gate a deploy or run in CI.
#
# Usage:
#   bash scripts/smoke-test.sh                 # against production
#   BASE=https://staging... bash scripts/smoke-test.sh
#
# Optional autobackup check (mutates nothing user-facing — starts a managed
# Firestore export): set CRON_SECRET to also exercise POST /api/cron/backup.
#   CRON_SECRET=$(gcloud secrets versions access latest --secret=CRON_SECRET \
#     --project=nilamit-52073) bash scripts/smoke-test.sh

set -uo pipefail
BASE="${BASE:-https://www.nilamit.com}"
pass=0; fail=0

# chk <METHOD> <PATH> <EXPECTED_CODES_CSV> <LABEL>  (POST sends an empty JSON body)
chk() {
  local m="$1" u="$2" exp="$3" lbl="$4" code
  if [ "$m" = "POST" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE$u")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$m" "$BASE$u")
  fi
  if echo "$exp" | tr ',' '\n' | grep -qx "$code"; then
    printf '  PASS [%s] %s\n' "$code" "$lbl"; pass=$((pass+1))
  else
    printf '  FAIL [%s, want %s] %s\n' "$code" "$exp" "$lbl"; fail=$((fail+1))
  fi
}

echo "── Public pages (200) ──"
for p in / /browse /auctions /leaderboard /how-it-works /faq /safety /privacy /terms /contact /login /register /social; do
  chk GET "$p" 200 "$p"
done
chk GET /search 200,302,307 "/search → /auctions"

echo "── PWA assets, APK, SEO, health ──"
chk GET /manifest.json 200 "manifest"
chk GET /sw.js 200 "service worker"
chk GET /icon-192.png 200 "icon-192"
chk GET /robots.txt 200 "robots"
chk GET /sitemap.xml 200 "sitemap"
chk GET /downloads/nilamit.apk 200 "Android APK"
chk GET "/api/og?title=Smoke&price=100&location=Dhaka" 200 "OG image"
chk GET /api/health 200 "health"

echo "── Auth-gated APIs (401 without session) ──"
chk GET  /api/firebase/token 401 "firebase token"
chk POST /api/fcm/register   401 "fcm register"
chk POST /api/upload         401 "upload"

echo "── Cron security (401 without bearer) ──"
chk POST /api/cron/close-auctions 401 "cron close-auctions"
chk POST /api/cron/process-alerts 401 "cron process-alerts"
chk POST /api/cron/backup         401 "cron backup"

echo "── Protected route (unauth → login) ──"
chk GET /dashboard 200,302,307 "dashboard → login"

# Optional: exercise the autobackup pipeline if CRON_SECRET is provided.
if [ -n "${CRON_SECRET:-}" ]; then
  echo "── Autobackup e2e ──"
  resp=$(curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" -d '{}' "$BASE/api/cron/backup")
  if echo "$resp" | grep -q '"success":true'; then
    printf '  PASS backup export started: %s\n' "$(echo "$resp" | grep -o 'firestore/[^"]*' | head -1)"; pass=$((pass+1))
  else
    printf '  FAIL backup: %s\n' "$resp"; fail=$((fail+1))
  fi
fi

echo ""
echo "RESULT: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
