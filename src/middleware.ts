import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth.config';
import { env } from './lib/env';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const currentOrigin = `${protocol}://${host}`;
  
  const redirectBase = (env.NEXTAUTH_URL && !env.NEXTAUTH_URL.includes('nilamit.com'))
    ? env.NEXTAUTH_URL
    : currentOrigin;

  // 1. Legacy Redirect: /en/* -> /*
  if (pathname === '/en') {
    return NextResponse.redirect(new URL('/', redirectBase));
  }
  if (pathname.startsWith('/en/')) {
    return NextResponse.redirect(new URL(pathname.replace(/^\/en/, ''), redirectBase));
  }

  // 2. Global Security: Redirect banned users
  const isBanned = (req.auth?.user as { isBanned?: boolean })?.isBanned;
  if (isBanned && pathname !== '/banned') {
    return NextResponse.redirect(new URL('/banned', redirectBase));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
