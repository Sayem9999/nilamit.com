import { NextRequest } from 'next/server';
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
  
  // 1. Strip locale from API routes BEFORE NextAuth or intl handles them
  const localeApiMatch = pathname.match(/^\/(en|bn)?(\/api\/.*)/);
  if (localeApiMatch) {
    const apiPath = localeApiMatch[2];
    if (apiPath.includes('/auth/error')) {
      const locale = localeApiMatch[1] || 'en';
      return Response.redirect(new URL(`/${locale}/login?error=AuthError`, req.url));
    }
    // If there was a locale prefix, strip it and redirect to the raw /api/ path
    if (localeApiMatch[1]) {
      return Response.redirect(new URL(apiPath, req.url));
    }
  }

  // 2. If it's an API route, let NextAuth or Next handle it natively
  if (pathname.startsWith('/api')) {
    return;
  }

  // 3. For all other routes, let next-intl handle the locales
  return intlMiddleware(req);
});

export const config = {
  // Match only internationalized pathnames, but exclude API, _next, etc.
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
