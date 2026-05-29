# Google Cloud project-quota increase — paste-ready form

Current state on your account (`md.moimsarkar22@gmail.com`):
- **2 active** projects: `nilamit-52073`, `bd-business-market-f489f`
- **4 soft-deleted** projects (still count against quota for 30 days):
  - `gen-lang-client-0340279906`
  - `gen-lang-client-0534881866`
  - `project-8acd3221-18a5-45f2-9cb`
  - `project-cde7dd02-9086-4dbf-9cb`

Cap is currently ~5 projects → need it raised to 12 to have headroom
for staging + future test environments.

## Step 1 — Open the form

https://support.google.com/code/contact/project_quota_increase

Sign in as `md.moimsarkar22@gmail.com`.

## Step 2 — Paste these answers

| Field | Paste this |
|---|---|
| **Email** | `md.moimsarkar22@gmail.com` |
| **Company / Organization** | `Nilamit (nilamit.com)` |
| **Number of projects you currently have** | `2 active, 4 in 30-day soft-delete` |
| **Total project quota requested** | `12` |
| **Why?** *(justification)* | Paste the block below |

### Justification text (paste into the "Why?" field)

```
We operate https://www.nilamit.com — a production C2C auction
marketplace serving Bangladesh, running on Firebase App Hosting in
project nilamit-52073.

We need additional project headroom to provision:

1. nilamit-staging — a separate Firebase project mirroring production
   for PR-based staging deploys. Required so we can test schema
   migrations, payment-flow changes, and security-rule updates against
   isolated data before promoting to production. The CI/CD workflow
   is already implemented (.github/workflows/staging-deploy.yml in our
   repo); only the project provisioning is blocked.

2. Headroom for future per-environment isolation (dev, QA, EU-residency
   if we expand outside BD).

Our currently-soft-deleted projects were all auto-created during
initial Firebase/Gemini setup and contain no production data — we
deleted them specifically to free quota, but the 30-day soft-delete
window still counts them against the cap.

Requesting a total quota of 12 projects to provide ~5 slots of
operational headroom. We have an active billing account
(nilamit-52073) with consistent monthly spend on App Hosting,
Firestore, Cloud Vision SafeSearch, and Cloud Tasks.

Thank you.
```

### What to expect

- Auto-acknowledgement email within minutes.
- Manual review by a Google reviewer.
- **Typical SLA: 1–2 business days.** Sometimes same-day if the
  reviewer hits the queue quickly.
- Approval shows up in console + as an email; the new cap is in
  effect immediately.

## Step 3 — After approval, create staging

```bash
firebase projects:create nilamit-staging --display-name "Nilamit Staging"
```

Then follow `docs/STAGING.md` from step 2 onward (the runbook is
already complete; only step 1 was blocked).

## If denied

Google sometimes denies the first request asking for more context.
Re-submit with:
- Add a screenshot of your production traffic (Cloud Run metrics or
  App Hosting backend overview tab).
- Specify a smaller increase (try 8 → 10 instead of 12) if they push
  back on cost.
- Mention you have an active Blaze (pay-as-you-go) billing plan attached.
