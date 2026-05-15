import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth.config';
import { env } from './lib/env';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const currentOrigin = `${protocol}://${host}`;
  
  // 1. Canonical Redirect: nilamit.com -> www.nilamit.com (canonical www)
  if (host === 'nilamit.com') {
    const redirectUrl = new URL(pathname + req.nextUrl.search, 'https://www.nilamit.com');
    return NextResponse.redirect(redirectUrl, 301);
  }
  
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

  // 3. Security Headers
  const response = NextResponse.next();
  
  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://accounts.google.com https://apis.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://utfs.io;
    font-src 'self' https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://accounts.google.com https://nilamit-52073.firebaseapp.com;
    connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://vitals.vercel-insights.com;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
