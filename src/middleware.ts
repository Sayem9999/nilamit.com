import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
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
  
  // Dynamically determine the redirect base to avoid hardcoded domain redirects
  // if the production domain (nilamit.com) isn't live yet.
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const currentOrigin = `${protocol}://${host}`;
  
  // Prefer NEXTAUTH_URL only if it doesn't point to the unpurchased domain
  const redirectBase = (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('nilamit.com'))
    ? process.env.NEXTAUTH_URL
    : currentOrigin;

  // 0. Global Security: Redirect banned users
  const isBanned = (req.auth?.user as { isBanned?: boolean })?.isBanned;
  if (isBanned && !pathname.includes('/banned') && !pathname.startsWith('/api')) {
    const locale = pathname.split('/')[1] || 'en';
    return Response.redirect(new URL(`/${locale}/banned`, redirectBase), 307);
  }

  // 1. Strip locale from API routes BEFORE NextAuth or intl handles them
  const localeApiMatch = pathname.match(/^\/(en|bn)?(\/api\/.*)/);
  if (localeApiMatch) {
    const apiPath = localeApiMatch[2];
    if (apiPath.includes('/auth/error')) {
      const locale = localeApiMatch[1] || 'en';
      return Response.redirect(new URL(`/${locale}/login?error=AuthError`, redirectBase), 307);
    }
    // If there was a locale prefix, strip it and redirect to the raw /api/ path
    if (localeApiMatch[1]) {
      return Response.redirect(new URL(apiPath, redirectBase), 307);
    }
  }

  // 2. For all other routes, let next-intl handle the locales
  const response = intlMiddleware(req) || new NextResponse(null, { status: 200 });

  // 3. Security Headers (Apply to ALL routes including /api)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google-analytics.com https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
    );
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // 4. API Early Return (Headers are now set)
  if (pathname.startsWith('/api')) {
    return response;
  }

  return response;
});

export const config = {
  // Match everything except Next.js internals and static files. /api/* is
  // intentionally included so the locale-stripping branch above can rewrite
  // /{locale}/api/* and the /auth/error redirect can fire; /api/* requests
  // that don't need rewriting hit the early return on the `pathname.startsWith('/api')` check.
  matcher: ['/((?!_next|.*\\..*).*)']
};
