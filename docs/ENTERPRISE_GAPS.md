# Enterprise gaps — what landed in this PR, what's still TODO

This doc enumerates the 10 enterprise gaps surfaced in the May-2026 audit
and where each one stands after the "do all 10" push. Items marked
**scaffolded** ship working code but need external accounts/credentials
to fully activate.

## Status

| # | Gap | Status | Activation work needed |
|---|-----|--------|------------------------|
| 1 | Staging env + canary deploy | **scaffolded** | Create `nilamit-staging` Firebase project (see `docs/STAGING.md`) |
| 2 | Proxy / max bidding | **already shipped** | BidProcessor already implements `proxyMaxBid`/`proxyBidderId`. UI hint added to BidPanel. |
| 3 | RUM via web-vitals → BigQuery | **fully shipped** | None — `web-vitals` package installed, reporter mounted, `/api/rum` route live, ships to `nilamit_events.events`. Build Looker Studio dashboard from the `web_vital` event_type. |
| 4 | Pub/Sub fan-out + idempotency | **scaffolded** | `npm install @google-cloud/pubsub`, create topics + subscriber Cloud Functions, set `PUBSUB_TOPIC_PREFIX=nilamit-prod`. Inline RTDB+FCM path keeps working until then. |
| 5 | Seller analytics dashboard | **schema added** | `Auction.viewCount` field added. Need: increment on auction-detail page hit + new dashboard tab UI. |
| 6 | Featured-listing self-serve purchase | **shipped** | End-to-end: `src/services/finance/featured.ts` (pricing + `feat_` tran codec), `src/lib/featured-service.ts` (idempotent, amount-guarded activation), `src/actions/featured.ts` (quote/initiate), `feat_` routing in the payment callback, `/api/cron/expire-featured` (wired hourly in cron.yml), and `FeatureListingButton` mounted on the seller's auction detail page. Remaining platform-wide gap: no gateway *init* endpoint exists yet (escrow shares this) — the button reserves the tran id; drop the init URL in when built. |
| 7 | WhatsApp + SMS notifications | **adapters shipped** | `src/lib/notification-channels.ts` adapter pattern + Twilio WhatsApp + SMS adapter. Need: `TWILIO_*` secrets + Meta WhatsApp template approvals + BD SMS gateway credentials. |
| 8 | Seller KYC | **shipped** | Full pipeline live: `src/actions/kyc.ts`, seller `KycSubmissionForm`, admin `KycTab` moderation queue. `listPendingKyc` now mints fresh 1-hour signed URLs at view time so docs never 404 in the queue (previously relied on the 7-day upload URL). |
| 9 | Saved searches + price alerts | **scaffolded** | `savedSearches` collection + CRUD Server Actions. Need: cron job at `/api/cron/saved-search-matches` to run filter queries against new auctions and fire notifications. |
| 10 | PWA install prompt + offline shell | **install prompt shipped** | `InstallPrompt` component mounted in Providers — surfaces after 15s dwell. Offline shell (Workbox cache for `/auctions` list, background-sync queue) is the still-pending follow-up. |

## What "scaffolded" means in this context

The pattern: code is wired in the production-ready shape, but external
dependencies (vendor accounts, secrets, new GCP infra) need provisioning
before users see the feature. Every scaffolded path is env-gated and
no-ops cleanly when its dependencies aren't set — nothing breaks in the
existing flow.

## Recommended activation order

1. **Gap 1 (staging env)** — protects everything else. ~30min setup per `docs/STAGING.md`.
2. **Gap 3 (RUM)** — already live; build a Looker Studio query against `event_type='web_vital'` so you can see what your real users experience.
3. **Gap 8 (KYC UI)** — finish the seller form + admin queue. Trust signal that helps every seller-facing feature.
4. **Gap 6 (Featured purchase UI)** — finish the seller-facing flow. Revenue-positive.
5. **Gap 5 (Analytics dashboard)** — finish the dashboard tab. Sellers ask for this constantly.
6. **Gap 4 (Pub/Sub)** — only matters at scale. Wait until you have >100 bids/min sustained.
7. **Gap 7 (WhatsApp)** — needs Meta template approval (~3 days). Start the approval process early.
8. **Gap 9 (Saved searches cron)** — finish the cron job once you have >1k active users.
9. **Gap 10 (Offline shell)** — final polish; useful once mobile traffic is dominant.

## Files added in this PR

```
src/lib/idempotency.ts                              # cache for at-most-once Server Actions
src/lib/notification-channels.ts                    # multi-channel adapter (RTDB/FCM/email/SMS/WhatsApp)
src/lib/pubsub.ts                                   # @google-cloud/pubsub publisher (env-gated)
src/actions/saved-search.ts                         # CRUD for savedSearches collection
src/actions/featured.ts                             # quoteFeaturedPurchase + activateFeatured
src/actions/kyc.ts                                  # submitKyc + admin approve/reject + queue list
src/app/api/rum/route.ts                            # web-vitals ingestion → BigQuery
src/components/rum/WebVitalsReporter.tsx            # client RUM reporter (mounts in Providers)
src/components/pwa/InstallPrompt.tsx                # beforeinstallprompt UX
apphosting-staging.yaml                             # mirror of apphosting.yaml for staging backend
.github/workflows/staging-deploy.yml                # PR → staging auto-deploy
docs/STAGING.md                                     # staging setup runbook
docs/ENTERPRISE_GAPS.md                             # this file
```

## Schema additions

- `User.kycStatus`, `kycSubmittedAt`, `kycDocsRef`, `kycRejectReason`, `kycReviewedAt`, `kycReviewedBy`
- `User.notificationChannels` (inApp/fcm/email/sms/whatsapp prefs)
- `User.phoneNumber`, `User.phoneVerified`
- `User.fcmTokens`, `User.fcmTokensUpdatedAt` (was implicit; now declared)
- `Auction.viewCount`
- `Auction.featuredUntil`, `Auction.featuredPurchasedBy`
- `Bid.idempotencyKey`
- New collection: `savedSearches/{id}` keyed by `userId`
- New collection: `idempotency/{key}` (1h TTL — set via Firestore TTL policy)
