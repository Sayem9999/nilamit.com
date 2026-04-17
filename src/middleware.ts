import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

export default createMiddleware({
  locales: [...locales],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export const config = {
  // Match everything except Next internals, API routes, and static files.
  matcher: ['/((?!api|_next|.*\\..*|sw\\.js|manifest\\.json).*)'],
};
