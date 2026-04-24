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
  // Trust NEXTAUTH_URL as the canonical origin in deployed environments;
  // fall through to req.url locally so dev with arbitrary host:port works.
  const redirectBase = process.env.NEXTAUTH_URL ?? req.url;

  // 0. Global Security: Redirect banned users
  const isBanned = (req.auth?.user as { isBanned?: boolean })?.isBanned;
  if (isBanned && !pathname.includes('/banned') && !pathname.startsWith('/api')) {
    const locale = pathname.split('/')[1] || 'en';
    return Response.redirect(new URL(`/${locale}/banned`, redirectBase), 308);
  }

  // 1. Strip locale from API routes BEFORE NextAuth or intl handles them
  const localeApiMatch = pathname.match(/^\/(en|bn)?(\/api\/.*)/);
  if (localeApiMatch) {
    const apiPath = localeApiMatch[2];
    if (apiPath.includes('/auth/error')) {
      const locale = localeApiMatch[1] || 'en';
      return Response.redirect(new URL(`/${locale}/login?error=AuthError`, redirectBase), 308);
    }
    // If there was a locale prefix, strip it and redirect to the raw /api/ path
    if (localeApiMatch[1]) {
      return Response.redirect(new URL(apiPath, redirectBase), 308);
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
  // Match all paths except Next.js internals and static files
  matcher: ['/((?!_next|.*\\..*).*)']
};
