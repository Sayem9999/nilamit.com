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
  const nonce = btoa(
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => String.fromCharCode(b))
      .join('')
  );

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  // Content Security Policy
  const cspHeader = `
    default-src 'self' https://*.nilamit.com https://nilamit.com https://*.hosted.app https://*.firebaseapp.com https://*.web.app;
    script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://*.nilamit.com https://nilamit.com https://*.hosted.app https://js.sentry-cdn.com https://browser.sentry-cdn.com https://*.pusher.com https://*.firebaseio.com https://*.firebasedatabase.app https://*.asia-southeast1.firebasedatabase.app https://www.gstatic.com https://*.googleapis.com https://www.google.com https://*.recaptcha.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.nilamit.com https://nilamit.com https://*.hosted.app;
    img-src 'self' data: blob: https://*.googleusercontent.com https://utfs.io https://*.uploadthing.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://avatars.githubusercontent.com https://i.pravatar.cc https://images.unsplash.com https://*.ingest.sentry.io https://*.nilamit.com https://nilamit.com https://*.hosted.app;
    font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com;
    connect-src 'self' https://*.googleapis.com https://storage.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.asia-southeast1.firebasedatabase.app wss://*.asia-southeast1.firebasedatabase.app https://*.cloudfunctions.net https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.sentry.io https://utfs.io https://*.uploadthing.com https://*.nilamit.com https://nilamit.com https://*.hosted.app https://*.firebaseapp.com https://www.google.com https://*.recaptcha.net;
    frame-src 'self' https://*.firebaseapp.com https://*.firebaseio.com https://*.firebasedatabase.app https://*.asia-southeast1.firebasedatabase.app https://*.nilamit.com https://nilamit.com https://*.hosted.app https://www.google.com https://*.recaptcha.net;
    media-src 'self' https://*.nilamit.com https://nilamit.com https://*.hosted.app;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://*.nilamit.com https://nilamit.com https://*.hosted.app https://*.firebaseapp.com;
    frame-ancestors 'none';
    worker-src 'self' blob:;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
