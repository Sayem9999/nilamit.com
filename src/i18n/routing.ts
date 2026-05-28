import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

// Supported locales. Locale selection is cookie-driven (NEXT_LOCALE), not URL
// path prefix — keeps existing /auctions URLs unchanged for SEO.
// Add a new locale here, in src/i18n.ts, AND ship messages/<locale>.json.
export const locales = ['en', 'bn'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: 'en'
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
