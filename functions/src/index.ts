/**
 * Cloud Functions — intentionally empty.
 *
 * Nilamit's scheduled jobs run via GitHub Actions (.github/workflows/cron.yml),
 * which POSTs the /api/cron/* and /api/tasks/* endpoints with Bearer ${CRON_SECRET}.
 * Per-auction timing (close-auction, closing-soon, enforce-policies) is handled
 * by Cloud Tasks (src/lib/cloud-tasks.ts) against the same endpoints.
 *
 * Previously this file also defined `onSchedule` triggers hitting the SAME
 * endpoints, which created Cloud Scheduler jobs that double-fired every cron
 * (duplicate "closing soon" emails, double policy runs). Those were removed so
 * there is exactly ONE scheduler. Do not re-add `onSchedule` here unless you
 * also disable the GitHub Actions workflow. `firebase.json` no longer registers
 * a `functions` codebase, so `firebase deploy` will not deploy anything here.
 */

export {};
