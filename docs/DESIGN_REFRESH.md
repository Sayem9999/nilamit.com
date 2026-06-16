# Design Critique & Visual Refresh — nilamit.com

> June 16, 2026. Whole-site visual refresh. Reviewed against the live components
> (`Navbar`, `HeroSection`, `AuctionCard`, `CategoryGrid`, `Footer`) and the
> token layer (`globals.css`, `layout.tsx`, `docs/STYLE.md`).

## Overall Impression

The marketplace is structurally sound and follows a sensible eBay-style
information order (search → categories → ending-soon → trending → trust). The
biggest opportunity is not layout — it's **fit and finish at the token layer**.
A handful of centralized issues (a dead heading font, a generic blue ramp with
an inverted step, hard-edged radii, a harsh black search border) make a solid
product read as "default Tailwind" rather than a designed brand. Fixing them at
the token level refreshes every page at once.

## Highest-impact findings

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | `layout.tsx` loads Plus Jakarta Sans for headings, but `globals.css` `@theme` hardcodes `--font-heading: "Inter"`, so the loaded display font is never used. Body/mono tokens are static literals too, so the self-hosted faces only resolve by luck of the OS. | 🔴 Critical | Reference the next/font runtime variables from the `@theme` tokens (`var(--font-display)` etc.). Headings gain real character for free. |
| 2 | Primary ramp is a generic blue and the steps are non-monotonic — `700 (#0046d5)` is *brighter* than `600 (#2b51d0)`, so emphasis text looks lighter than buttons. | 🟡 Moderate | Replace with a harmonized, monotonic indigo-blue ramp; keep the oklch `--primary` in sync. |
| 3 | Navbar search uses `border-2 border-gray-900 rounded-sm` — a heavy black box that fights the otherwise soft, light UI. | 🟡 Moderate | Soften to a `border-gray-300`, larger radius, primary focus ring. It's the single most-looked-at element on the site. |
| 4 | Radius is hard (`--radius: 0.5rem` → cards/inputs at ~6px). Combined with flat `shadow-sm`, surfaces feel boxy. | 🟢 Minor | Nudge base radius up and refine the elevation utilities for softer, more premium cards. |
| 5 | Inconsistent radii across components (`rounded-sm`, `-md`, `-xl`, `-2xl`, `-full`) — STYLE.md itself flags the drift. | 🟢 Minor | Let components inherit the scaled radius tokens; standardize cards on one step. |

## Visual hierarchy

What draws the eye first today is the **black-bordered search bar** (correct
target) followed by the blue Sell CTA (also correct). The refresh keeps that
order but lets the search read as inviting rather than severe, and gives section
headings a distinct display face so the eye finds rail titles faster.

## Consistency

| Element | Issue | Fix |
|---------|-------|-----|
| Headings | Documented as Plus Jakarta, rendered as Inter | Wire the font (finding 1) |
| Primary color | Ramp inversion at 600/700 | Monotonic ramp (finding 2) |
| Radius | 5+ radius values in the wild | Inherit scaled tokens (findings 4–5) |
| Search input | Unique heavy black border | Align to the system input style |

## Accessibility (preserved / improved)

- Contrast: refreshed primary keeps white-on-primary ≥ 4.5:1 for button text.
- Touch targets: search and Sell CTA remain ≥ 40px; unchanged.
- Focus: refresh standardizes a visible primary focus ring on the search field.
- Pinch-zoom and `text-[10px]` legibility floor untouched.

## What works well

- Sensible marketplace content order and cold-start handling.
- Honest empty/ghost-town guards (stats hidden until meaningful).
- Self-hosted fonts, CSP-clean, no render-blocking `@import`.
- Thoughtful countdown/bid animations already defined as utilities.

## Priority recommendations (implemented in this pass)

1. **Wire the display font + fix token plumbing** — headings render in Plus
   Jakarta Sans; body/mono resolve to the self-hosted faces reliably.
2. **Harmonize the primary ramp** — monotonic, slightly richer blue; oklch
   `--primary`/`--ring` kept in sync.
3. **Soften and unify shape** — friendlier base radius and refined card
   elevation; the navbar search loses the black box.
4. **Component polish** — Hero, AuctionCard, CategoryGrid, Footer aligned to the
   refreshed tokens.

All changes are token-first and backward-compatible: no API, data, or layout
changes, so the refresh is low-risk on the live deployment.
