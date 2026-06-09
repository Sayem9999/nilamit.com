# 🎨 nilamit.com — Style Guide & Design System

> Last Updated: June 9, 2026 (reconciled to the implemented tokens in
> `src/app/globals.css` — the prior version documented an aspirational palette
> that didn't match the code).

> White & Blue. Clean. Trustworthy. Welcoming.

---

## Color Palette

### Primary — Blue (Trust) — actual tokens in `globals.css`

Use the Tailwind `primary-*` utilities (e.g. `bg-primary-600`, `text-primary-700`).
These are the real hex values:

```
--color-primary-50:  #f4f7fd   (backgrounds, hover states)
--color-primary-100: #e2e8f5   (light cards, tag backgrounds)
--color-primary-200: #c8d6f0   (borders, dividers)
--color-primary-500: #3665f3   (links, primary surface)
--color-primary-600: #2b51d0   (primary buttons + hover/active — distinct from 500)
--color-primary-700: #0046d5   (emphasis)
--color-primary-900: #0b2240   (dark text, footer)
```

> Note: 500 and 600 were once the same hex (`#3665f3`), which made button
> hover invisible. 600 is now `#2b51d0` — keep them distinct.

### Neutral — White/Gray (Clean)

```
--white:    #ffffff   (page backgrounds)
--gray-50:  #f9fafb   (alternate sections, card backgrounds)
--gray-100: #f3f4f6   (input backgrounds)
--gray-200: #e5e7eb   (borders)
--gray-400: #9ca3af   (placeholder text)
--gray-500: #6b7280   (secondary text)
--gray-700: #374151   (body text)
--gray-900: #111827   (headings)
```

### Semantic

```
--green-500: #22c55e  (success, winning bid)
--red-500:   #ef4444  (error, auction ending soon)
--amber-500: #f59e0b  (warning, outbid notification)
```

---

## Typography

| Role         | Font                  | Tailwind class | Notes |
| ------------ | --------------------- | -------------- | ----- |
| Headings     | **Plus Jakarta Sans** | `font-heading` | applied via the `--font-heading` next/font var on `<body>` |
| Body         | **Inter**             | `font-body` (default) | |
| Mono/Prices  | **JetBrains Mono**    | `font-mono`    | use `formatBDT()` for amounts |
| Bengali text | **Noto Sans Bengali** | `font-bengali` | |

### Loading — do NOT use a CSS `@import`

All four fonts are **self-hosted via `next/font/google` in `layout.tsx`** (one
place, deduplicated, no render-blocking external request, CSP-clean). A Google
Fonts `@import` in `globals.css` was removed because it duplicated these loads.
To add a weight, edit the `next/font` config in `layout.tsx` — never re-add the
`@import`.

### Minimum text size

Floor is **`text-[10px]`** (sub-10px `text-[8px]`/`text-[9px]` were removed for
legibility on mid-range Android). Prefer `text-xs` (12px) for anything users
must read; reserve 10–11px for dense, secondary metadata only.

---

## Component Patterns

### Buttons

```
Primary:    bg-blue-600 text-white hover:bg-blue-700 rounded-xl px-6 py-3 font-semibold shadow-sm
Secondary:  bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-xl
Ghost:      text-blue-600 hover:bg-blue-50 rounded-xl
Danger:     bg-red-50 text-red-600 hover:bg-red-100 rounded-xl
```

### Cards

```
Default:    bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition
Featured:   bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl
```

### Inputs

```
Default:    bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent
```

### Badges/Tags

```
Active:     bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-medium
Ending:     bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-medium
Category:   bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-medium
```

---

## Spacing & Layout

- Page max-width: `max-w-7xl mx-auto`
- Section padding: `py-16 sm:py-24`
- Card grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`
- Border radius: the codebase predominantly uses **`rounded-md`** for cards,
  inputs, and buttons (the de-facto default), with `rounded-full` for badges/
  avatars. `rounded-xl`/`rounded-lg` also appear — when in doubt, match the
  surrounding surface rather than introducing a new radius.

---

## Animation Guidelines

| Element          | Animation                    | Duration       |
| ---------------- | ---------------------------- | -------------- |
| Page sections    | Fade in + slide up           | 600ms ease-out |
| Cards on hover   | Scale 1.02 + shadow increase | 200ms          |
| Bid confirmation | Scale pulse + checkmark      | 400ms          |
| Countdown < 1min | Red pulse glow               | 1s infinite    |
| Button click     | Scale 0.97 → 1.0             | 150ms          |

---

## Code Conventions

### File Naming

- Components: `PascalCase.tsx` (e.g., `AuctionCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Server Actions: `camelCase.ts` in `src/actions/` (e.g., `bid.ts`)
- Pages: `page.tsx` in route directories

### Import Order

```typescript
// 1. React/Next.js
import { useState } from "react";
import Link from "next/link";

// 2. External libraries
import { motion } from "framer-motion";
import { format } from "date-fns";

// 3. Internal components
import { AuctionCard } from "@/components/auction/AuctionCard";

// 4. Utilities/types
import { formatBDT } from "@/lib/format";
import type { Auction } from "@Firestore/client";
```

### Currency Formatting

```typescript
// Always use this helper — never format BDT manually
formatBDT(amount: number): string → "৳1,23,456"
// Uses Bangladeshi number system (lakhs, crores) not Western (millions)
```

---

_This guide ensures visual consistency across all contributors and AI agents working on the project._
