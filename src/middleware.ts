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
  const pathname = req.nextUrl.pathname;
  
  // If NextAuth accidentally prepends the locale (e.g. /en/api/auth/error), strip it
  const localeApiMatch = pathname.match(/^\/(en|bn)(\/api\/.*)/);
  if (localeApiMatch) {
    return Response.redirect(new URL(localeApiMatch[2], req.url));
  }

  const isApiRoute = pathname.startsWith('/api');
  
  if (isApiRoute) {
    return;
  }

  return intlMiddleware(req);
});

export const config = {
  // Match only internationalized pathnames, but exclude API, _next, etc.
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
