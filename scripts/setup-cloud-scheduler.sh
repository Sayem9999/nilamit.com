#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# DEPRECATED — DO NOT RUN.
# ═══════════════════════════════════════════════════════════════
#
# Nilamit's cron is handled EXCLUSIVELY by GitHub Actions:
#     .github/workflows/cron.yml
# which POSTs the /api/cron/* and /api/tasks/* endpoints with
# Bearer ${CRON_SECRET} on schedule.
#
# This script used to create Google Cloud Scheduler jobs. Running it
# again would stand up a SECOND scheduler that double-fires every cron
# job (duplicate "closing soon" emails, double policy enforcement) — and
# several of its endpoint paths were wrong/stale anyway
# (e.g. /api/cron/process-auctions, /api/cron/closing-soon). That
# duplicate-cron bug was removed in 2026-05; this file is kept only so
# old references don't 404.
#
# If stale Cloud Scheduler jobs still exist in the project, delete them:
#     gcloud scheduler jobs list   --location=us-central1 --project=<PROJECT_ID>
#     gcloud scheduler jobs delete <JOB_NAME> --location=us-central1 --project=<PROJECT_ID>
# ═══════════════════════════════════════════════════════════════

echo "DEPRECATED: Nilamit cron is managed by GitHub Actions (.github/workflows/cron.yml)."
echo "This script will NOT create Cloud Scheduler jobs — a second scheduler double-fires cron."
echo "See the header comment for how to delete any stale scheduler jobs."
exit 1
