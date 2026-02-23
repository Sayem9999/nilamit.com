import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'bn'],
  defaultLocale: 'en'
});

const authMiddleware = NextAuth(authConfig).auth;

// Pages that require authentication
const protectedPatterns = ['/dashboard', '/profile', '/auctions/create', '/admin'];

function isProtectedPage(pathname: string): boolean {
  // Strip locale prefix
  const path = pathname.replace(/^\/(en|bn)/, '') || '/';
  return protectedPatterns.some(p => path.startsWith(p));
}

export default function middleware(req: NextRequest) {
  if (isProtectedPage(req.nextUrl.pathname)) {
    // Protected: run auth then intl
    return (authMiddleware as any)(req, (req: NextRequest) => intlMiddleware(req));
  }
  // Public: just intl
  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
