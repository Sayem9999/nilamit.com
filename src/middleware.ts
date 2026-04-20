import createMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth.config';
import { locales } from './i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always'
});

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  
  if (isApiRoute) {
    return;
  }

  return intlMiddleware(req);
});

export const config = {
  // Match only internationalized pathnames, but exclude API, _next, etc.
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
