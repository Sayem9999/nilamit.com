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
  
  // If NextAuth accidentally prepends the locale (e.g. /en/api/auth/error), strip it or redirect
  const localeApiMatch = pathname.match(/^\/(en|bn)?(\/api\/.*)/);
  if (localeApiMatch) {
    const apiPath = localeApiMatch[2];
    if (apiPath.includes('/auth/error')) {
      const locale = localeApiMatch[1] || 'en';
      return Response.redirect(new URL(`/${locale}/login?error=AuthError`, req.url));
    }
    // Only redirect if there was a locale prefix that we need to strip
    if (localeApiMatch[1]) {
      return Response.redirect(new URL(apiPath, req.url));
    }
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
