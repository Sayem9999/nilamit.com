# 🎨 Nilamit Design System

> Last Updated: April 29, 2026

## Aesthetic Vision
"Modern, Trustworthy, and Accessible."

### Core Colors
| Color | Hex | Role |
| --- | --- | --- |
| **Ocean Blue** | `#003366` | Primary Actions, Brand Identity |
| **Pristine White** | `#FFFFFF` | Background, Clean Layouts |
| **Trust Green** | `#22C55E` | Successful Bids, Verified Badges |
| **Auction Gold** | `#F59E0B` | Active Countdown, High Interest |

### Visual Effects
- **Glassmorphism**: 
  - `bg-white/70` backdrop
  - `backdrop-blur-md`
  - `border-white/20`
- **Dynamic Shadows**:
  - `shadow-sm` for standard cards.
  - `shadow-xl` (with hover scale) for active auction items.

### Typography
- **Primary**: Inter / Outfit (Clean, modern sans-serif).
- **Secondary (Bangla)**: Hind Siliguri (For readable, professional Bengali).
- **Scale**: 
  - `text-4xl` for Hero pricing.
  - `text-sm` for technical metadata.

### Components
- **AuctionCard**: Grid-based, high-contrast imagery, bottom-pinned CTA.
- **StarMap**: Radial layout for social navigation, uses animated SVGs.
- **PriceBadge**: Floating indicator with pulsing animation when timer is < 1m.

## UI Patterns
1. **Zero-Tech Onboarding**: Minimize text, maximize icon-based navigation.
2. **The "Wait" State**: Skeleton loaders (`animate-pulse`) for all async data.
3. **Empty States**: Encouraging localized illustrations for "No items found".
