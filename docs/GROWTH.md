# GROWTH.md — getting Nilamit adopted (the operator playbook)

> Written June 2026, when the live site had **0 active auctions**. This doc is
> deliberately blunt: the platform is engineered well beyond prototype level —
> escrow, KYC, payments, search, courier are all built. **None of that creates
> users.** Marketplaces die from empty supply, not bad code. Everything below
> is ordered by what actually moves adoption.

---

## The one rule

**A marketplace with nothing to buy converts nobody.** Until there are ~50
live listings that real buyers want, do not spend a minute on features,
polish, or ads. Every hour goes into supply.

## The strategy: one niche, one city

eBay started with collectibles. Don't launch "everything in Bangladesh" —
launch **one category in Dhaka** where auctions beat fixed-price:

| Good niche candidates | Why auctions win there |
|---|---|
| Used smartphones | Price discovery is genuinely hard; hot demand; high FB-group volume |
| Gaming gear / consoles | Enthusiast buyers who enjoy bidding; price-sensitive |
| Collectibles (coins, stamps, cricket memorabilia) | Classic auction category; passionate niche |
| Camera gear | High value, informed buyers, real scarcity |

Pick ONE. You win when someone in that niche thinks "check Nilamit first."

## Phase 0 — seed supply yourself (this week)

1. **List 10–20 real items personally.** Yours, family's, friends'. Real
   photos, honest descriptions, low starting prices. The empty-marketplace
   states now funnel visitors to "Be the first to sell" — make sure they
   never see it.
2. **Recruit 5–10 founding sellers** from your network in the niche. Offer:
   free listing (already true), featured placement free (admin can set
   `isFeatured`), and *you do the work* — they send photos on WhatsApp, you
   create the listings for them. Concierge onboarding beats any signup flow.
3. **Every auction must end with a winner.** A bid-less first experience kills
   a founding seller. If an auction is dying, bid yourself or have your
   network bid honestly. (Do NOT shill-bid against real users — the platform's
   own shill detector will flag it, and it poisons trust. Seeding activity on
   your own/consented listings is different from inflating real buyers' prices.)

## Phase 1 — distribution where Bangladesh actually is

Forget SEO ads at this stage. BD commerce happens in **Facebook groups and
WhatsApp**:

1. **Facebook groups.** Every used-phone/camera/gaming group in Dhaka has
   10k–500k members. Post real listings there ("Auction ends Friday 9pm —
   current bid ৳12,500, no reserve") with the auction link. The countdown +
   live price is *content* fixed-price posts can't match. 3–5 groups, daily,
   manually. This is the founder's job for the first months.
2. **WhatsApp.** Every listing's Share button → WhatsApp. Sellers should share
   their own auction into their groups — give them a reason: "more watchers =
   higher final price."
3. **A weekly rhythm buyers can learn:** e.g. all auctions end Friday 8–10pm.
   Scarcity of timing concentrates bidders, concentration creates bid wars,
   bid wars create the screenshots people share.
4. **One trust artifact per week:** a short video/post of a completed
   sale — seller paid via escrow, buyer got the phone, both happy. Trust
   content is the marketing for a BD marketplace; scams are the #1 objection.

## Phase 2 — measure the funnel (now instrumented)

`user_signup` and `auction_created` (with `firstListing`) now ship to
BigQuery. Looker queries:
- **#9 Growth pulse** — signups / new listings / bids per day. The only
  dashboard that matters now. If `new_listings` is flat at 0, stop everything
  and go back to Phase 0.
- **#10 Seller activation** — % of signups posting a first listing within 7
  days. Healthy early-stage C2C: >10%. If it's ~0%, your signups are buyers
  hitting an empty shop — fix supply, not signup.

Weekly founder ritual (30 min): run #9 + #10, write down the one number
you'll move next week, and what you'll do offline to move it.

## Phase 3 — only after liquidity (do NOT do these early)

- Provision **Typesense** (search ceiling — `docs/SEARCH.md`) once there are
  >500 active listings for search to matter.
- Activate **SSLCommerz** (`docs/PAYMENTS.md`) when manual bKash verification
  becomes a real bottleneck (it won't be before dozens of sales/week).
- Activate **courier** (`COURIER_*`) when sellers ship more than they meet up.
- Referral program, push-notification campaigns, paid ads: multiplying zero
  is still zero. These come after organic word-of-mouth exists.

## What the platform already does for growth (shipped)

- Empty states funnel to "Be the first to sell" (supply-side CTA).
- Sitemap now includes every ACTIVE listing → each auction is a Google
  landing page ("<item> dam bangladesh" queries).
- OG images per auction → links unfurl with photo + price in
  WhatsApp/Facebook (the share channels that matter here).
- PWA install prompt + Android APK → repeat-visit retention.
- EN/বাংলা UI.
- Free listings, escrow trust rails, verified-seller badges.

## The honest math

- 10 founding sellers × 3 listings = 30 live auctions.
- 5 FB-group posts/day × ~2% click-through on 10k views ≈ ~100 visits/day.
- At ~5% bidder conversion, that's ~5 new bidders/day → real bid wars within
  two weeks → screenshots → word-of-mouth.
- **Total cost: ৳0 and the founder's evenings.** That is how every C2C
  marketplace you've heard of actually started.
