import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

// English-only deployment. next-intl is retained as the message-loading
// layer (every component uses useTranslations) but no locale switching
// happens. To re-introduce a locale, add it here AND in src/i18n.ts.
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en'
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
