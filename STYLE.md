# 🎨 nilamit.com — Style Guide & Design System

> White & Blue. Clean. Trustworthy. Welcoming.

---

## Color Palette

### Primary — Blue (Trust)

```
--blue-50:  #eff6ff   (backgrounds, hover states)
--blue-100: #dbeafe   (light cards, tag backgrounds)
--blue-200: #bfdbfe   (borders, dividers)
--blue-500: #3b82f6   (primary buttons, links)
--blue-600: #2563eb   (button hover, active states)
--blue-700: #1d4ed8   (headings, emphasis)
--blue-900: #1e3a5f   (dark text, footer)
```

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

| Role         | Font                  | Weight         | Size         |
| ------------ | --------------------- | -------------- | ------------ |
| Headings     | **Plus Jakarta Sans** | 700 (Bold)     | 2xl–4xl      |
| Body         | **Inter**             | 400 (Regular)  | sm–base      |
| Mono/Prices  | **JetBrains Mono**    | 600 (SemiBold) | lg           |
| Bengali text | **Noto Sans Bengali** | 400–700        | Matches role |

### Import

```css
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@500;600&display=swap");
```

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
- Border radius: `rounded-xl` (default) / `rounded-2xl` (cards) / `rounded-full` (badges)

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
import type { Auction } from "@prisma/client";
```

### Currency Formatting

```typescript
// Always use this helper — never format BDT manually
formatBDT(amount: number): string → "৳1,23,456"
// Uses Bangladeshi number system (lakhs, crores) not Western (millions)
```

---

_This guide ensures visual consistency across all contributors and AI agents working on the project._
