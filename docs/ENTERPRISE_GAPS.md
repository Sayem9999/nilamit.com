# Platform capability status — verified June 2026

> **Doc-truth audit (2026-06-09):** the original "10 enterprise gaps" table was
> badly stale — it listed as TODO several things that were already shipped.
> This is the reconciled, code-verified state. Each row was checked against the
> actual source, not assumed.
>
> **Reading guide:** *Shipped* = live & active. *Env-gated* = production-ready
> code that no-ops cleanly until you set its secrets (the platform's standard
> pattern — search, payments, courier all follow it). *Pending* = genuinely not
> built.

## The original 10 gaps (reconciled)

| # | Gap | Verified status | What's left |
|---|-----|--------|------|
| 1 | Staging env + canary | **Env-gated** | Code + `apphosting-staging.yaml` + `staging-deploy.yml` exist. Create the `nilamit-staging` Firebase project (`docs/STAGING.md`). |
| 2 | Proxy / max bidding | **Shipped** | `BidProcessor` implements `proxyMaxBid`/`proxyBidderId`; BidPanel UI live. |
| 3 | RUM → BigQuery | **Shipped** | Reporter mounted, `/api/rum` live, Looker queries in `LOOKER_QUERIES.sql`. Now also captures `effectiveType` for the TTFB-by-connection query (#8 in that file). |
| 4 | Pub/Sub fan-out | **Env-gated + wired** | `src/lib/pubsub.ts` is wired into `BidSideEffects` (publish() called). Set `PUBSUB_TOPIC_PREFIX` + create topics/subscribers. Inline RTDB+FCM keeps working until then. |
| 5 | Seller analytics dashboard | **Shipped** | `viewCount` increment wired (`auction-view.ts` + `AuctionViewTracker`); `/dashboard/analytics` shows views/bids/conversion. |
| 6 | Featured-listing purchase | **Shipped** | Full pipeline: `services/finance/featured.ts`, `lib/featured-service.ts`, `actions/featured.ts`, `feat_` routing in the callback, `/api/cron/expire-featured` (hourly), `FeatureListingButton`. Paid checkout via the SSLCommerz init below. |
| 7 | WhatsApp + SMS | **Env-gated** | `notification-channels.ts` adapters shipped. Needs `TWILIO_*` + Meta template approvals + BD SMS creds. |
| 8 | Seller KYC | **Shipped** | `actions/kyc.ts`, `KycSubmissionForm`, admin `KycTab`. `listPendingKyc` mints fresh 1h signed URLs so docs never 404. |
| 9 | Saved searches + alerts | **Shipped** | CRUD actions + `/api/cron/saved-search-matches` (wired in cron.yml). |
| 10 | PWA install + offline | **Mostly shipped** | `InstallPrompt` + `OfflineIndicator` live. Full Workbox offline shell (cache `/auctions`, bg-sync queue) is the remaining polish — the one genuinely *Pending* item here. |

## Capabilities added after the original audit (June 2026)

| Capability | Status | Notes |
|---|---|---|
| **External search engine** | **Env-gated** | Typesense adapter (`lib/search-engine.ts`) removes the 1000-doc in-memory scan cap. Reader queries engine → hydrates from Firestore (source of truth) → self-heals status. Backfill script + `docs/SEARCH.md` + `docs/SEARCH_SELFHOST.md`. Set `TYPESENSE_HOST`+`TYPESENSE_API_KEY` to activate. |
| **Payment init (SSLCommerz)** | **Env-gated** | The missing init half. `lib/sslcommerz.ts` + `POST /api/payments/sslcommerz/init`. Handles `featured` (live) and `escrow` advances. Returns 503 `GATEWAY_OFF` until `SSLCOMMERZ_STORE_ID`+`SSLCOMMERZ_STORE_PASSWORD` set. See `docs/PAYMENTS.md`. |
| **Escrow gateway + logistics-on-confirm** | **Env-gated** | `initEscrowGatewayPayment` seeds the `automationToken`; `verifyAndReleaseEscrow` now creates the logistics order on gateway settlement (closing the gap where the automated path skipped logistics). Dormant until SSLCommerz creds are set — soak in staging before going live. |
| **Courier integration** | **Env-gated** | `lib/courier.ts` (Steadfast; Pathao/RedX-ready) books real shipments in `createLogisticsOrder`; `/api/courier/webhook` feeds status back. Falls back to internal `NILAMIT_EXPRESS` tracking until `COURIER_API_KEY`+`COURIER_SECRET_KEY` set. |
| **Performance posture** | **Documented** | `docs/PERFORMANCE.md` — caching map, why auctions are intentionally uncached, and the data-locality (US `nam5` → BD) lever with a measurement query. |

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
