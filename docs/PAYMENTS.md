# Payments — init + verify

Two halves:

| Half | Where | What it does |
|---|---|---|
| **Init** | `POST /api/payments/sslcommerz/init` + `src/lib/sslcommerz.ts` | Mints a hosted-checkout session, returns `GatewayPageURL`. |
| **Verify** | `POST /api/payments/callback` + `PaymentService` / `FeaturedService` | Verifies the signed IPN, then settles escrow → HELD or activates a featured purchase. |

Both are **env-gated**: without `SSLCOMMERZ_STORE_ID` + `SSLCOMMERZ_STORE_PASSWORD`,
init returns `503 { code:'GATEWAY_OFF' }` and the rest of the app is unaffected.
The featured seller button degrades to a "contact support" message.

## Flow (featured listing — live today)

```
Seller clicks "Feature for ৳300"
  → POST /api/payments/sslcommerz/init { purpose:'featured', auctionId, days }
      → initiateFeaturedPurchase()  (ownership + tier validation, mints feat_ tran id)
      → createPaymentSession()      (SSLCommerz v4 init; value_a = feat_ tran id)
  → 200 { gatewayUrl } → browser redirects to hosted checkout
Buyer pays
  → SSLCommerz IPN → POST /api/payments/callback (hash verified)
      → tran_id starts with feat_ → activateFeaturedFromPayment()
          (idempotent by nonce, amount-guarded, sets isFeatured + featuredUntil)
  → /api/cron/expire-featured (hourly) flips isFeatured=false when the window ends
```

## Activation

```bash
firebase apphosting:secrets:set SSLCOMMERZ_STORE_ID       --project nilamit-52073 --data-file -
firebase apphosting:secrets:set SSLCOMMERZ_STORE_PASSWORD  --project nilamit-52073 --data-file -
firebase apphosting:secrets:grantaccess SSLCOMMERZ_STORE_ID       --project nilamit-52073 --backend nilamit
firebase apphosting:secrets:grantaccess SSLCOMMERZ_STORE_PASSWORD  --project nilamit-52073 --backend nilamit
```
Uncomment the two secret refs in `apphosting.yaml`. `SSLCOMMERZ_SANDBOX="true"`
is already set for sandbox merchant creds — flip to `false` for production.

## Planned follow-up: escrow advance via gateway

The escrow advance currently runs the **manual** path (`payEscrowAdvance` →
`VERIFICATION_PENDING` → admin approves → `HELD`). The gateway callback
(`verifyAndReleaseEscrow`) can already settle `PENDING → HELD` directly — it
locates the escrow by `automationToken`. Two gaps before switching escrow to the
gateway:

1. **Seed `automationToken`.** Add an init path
   (`{ purpose:'escrow', transactionId }`) that, in a transaction, writes a
   high-entropy `automationToken` onto the `PENDING` escrow and passes it as
   `value_a`. The callback already reads `value_a` to find the escrow.
2. **Create logistics on gateway-confirm.** `payEscrowAdvance` creates the
   logistics order at submission; `verifyAndReleaseEscrow` does **not**. So a
   gateway-settled escrow would be HELD + auction SOLD with **no shipping
   record**. Fix: have `verifyAndReleaseEscrow` call `createLogisticsOrder`
   (it must read both addresses inside the settlement transaction, then create
   logistics post-commit — mirror the manual path). This touches live money
   settlement, so ship it behind tests + a staging soak.

Until both land, escrow stays on the manual path and only **featured** uses the
gateway. That separation is intentional — featured has no logistics/settlement
entanglement, so it's the safe first revenue path.
