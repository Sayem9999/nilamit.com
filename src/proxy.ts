import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

import { NextRequest } from 'next/server';

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'bn'],
  defaultLocale: 'en'
});

const { auth } = NextAuth(authConfig);

// Pages that require authentication
const protectedPatterns = ['/dashboard', '/profile', '/auctions/create', '/admin'];

function isProtectedPage(pathname: string): boolean {
  // Strip locale prefix
  const path = pathname.replace(/^\/(en|bn)/, '') || '/';
  return protectedPatterns.some(p => path.startsWith(p));
}

export async function proxy(req: NextRequest) {
  return auth(async (innerReq) => {
    const isProtected = isProtectedPage(innerReq.nextUrl.pathname);
    
    if (isProtected && !innerReq.auth) {
      const localeMatch = innerReq.nextUrl.pathname.match(/^\/(en|bn)/);
      const locale = localeMatch ? localeMatch[1] : 'en';
      
      const loginUrl = new URL(`/${locale}/login`, innerReq.nextUrl);
      loginUrl.searchParams.set('callbackUrl', innerReq.url);
      
      return Response.redirect(loginUrl);
    }
    
    return intlMiddleware(innerReq);
  })(req, {});
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
