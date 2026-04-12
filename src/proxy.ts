import createIntlMiddleware from 'next-intl/middleware';
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'bn'],
  defaultLocale: 'en'
});

// Pages that require authentication
const protectedPatterns = ['/dashboard', '/profile', '/auctions/create', '/admin'];

function isProtectedPage(pathname: string): boolean {
  // Strip locale prefix
  const path = pathname.replace(/^\/(en|bn)/, '') || '/';
  return protectedPatterns.some(p => path.startsWith(p));
}

export const proxy = auth((req) => {
  const isProtected = isProtectedPage(req.nextUrl.pathname);
  
  if (isProtected && !req.auth) {
    const localeMatch = req.nextUrl.pathname.match(/^\/(en|bn)/);
    const locale = localeMatch ? localeMatch[1] : 'en';
    
    const loginUrl = new URL(`/${locale}/login`, req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', req.url);
    
    return Response.redirect(loginUrl);
  }
  
  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
