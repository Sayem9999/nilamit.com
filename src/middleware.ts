import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth.config';
import { locales } from './i18n';

import { env } from './lib/env';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always'
});

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  
  // Dynamically determine the redirect base to avoid hardcoded domain redirects
  // if the production domain (nilamit.com) isn't live yet.
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const currentOrigin = `${protocol}://${host}`;
  
  // Prefer NEXTAUTH_URL only if it doesn't point to the unpurchased domain
  const redirectBase = (env.NEXTAUTH_URL && !env.NEXTAUTH_URL.includes('nilamit.com'))
    ? env.NEXTAUTH_URL
    : currentOrigin;

  // 1. API routes should bypass intlMiddleware and go straight to handlers
  if (pathname.startsWith('/api')) {
    // Specialized Auth stripping: /en/api/auth -> /api/auth
    const localeApiMatch = pathname.match(/^\/(en|bn)(\/api\/auth\/.*)/);
    if (localeApiMatch) {
      return NextResponse.redirect(new URL(localeApiMatch[2], redirectBase));
    }
    return NextResponse.next();
  }
  
  // 2. Global Security: Redirect banned users
  const isBanned = (req.auth?.user as { isBanned?: boolean })?.isBanned;
  if (isBanned && !pathname.includes('/banned')) {
    const locale = pathname.split('/')[1] || 'en';
    return NextResponse.redirect(new URL(`/${locale}/banned`, redirectBase));
  }

  // 3. Let next-intl handle the locales for page routes
  return intlMiddleware(req);
});

export const config = {
  // Match everything except Next.js internals and static files. /api/* is
  // intentionally included so the locale-stripping branch above can rewrite
  // /{locale}/api/* and the /auth/error redirect can fire; /api/* requests
  // that don't need rewriting hit the early return on the `pathname.startsWith('/api')` check.
  matcher: ['/((?!_next|.*\\..*).*)']
};
