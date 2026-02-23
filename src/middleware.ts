import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'bn'],
  defaultLocale: 'en'
});

const authMiddleware = NextAuth(authConfig).auth;

export default function middleware(req: NextRequest) {
  // Public pages that don't require authentication
  const publicPathnameRegex = RegExp(
    `^(/(${['en', 'bn'].join('|')}))?(/login|/register|/how-it-works|/contact)?/?$`,
    'i'
  );
  
  const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname);

  if (isPublicPage) {
    return intlMiddleware(req);
  } else {
    return (authMiddleware as any)(req, (req: NextRequest) => intlMiddleware(req));
  }
}

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
