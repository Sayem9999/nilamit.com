import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'bn'],
  defaultLocale: 'en',
});

const RATE_LIMIT_RULES: Record<string, [number, number]> = {
  '/api/auth': [20, 60],
  '/api/firebase/token': [60, 60],
  '/api/upload': [10, 300],
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let lastPrune = Date.now();

function checkRateLimit(ip: string, pathname: string): boolean {
  const matchedEntry = Object.entries(RATE_LIMIT_RULES).find(([prefix]) =>
    pathname.startsWith(prefix)
  );
  if (!matchedEntry) return true;

  const [prefix, [max, windowSecs]] = matchedEntry;
  const key = `${ip}:${prefix}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowSecs * 1000 });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

function pruneRateLimitStore() {
  const now = Date.now();
  if (now - lastPrune < 5 * 60 * 1000) return;
  lastPrune = now;

  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

export const proxy = auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    pruneRateLimitStore();

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    if (!checkRateLimit(ip, pathname)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please slow down.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
