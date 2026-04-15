/**
 * Next.js Middleware — Nilamit
 *
 * Runs on every request before routing.
 * Responsibilities (in order):
 *   1. Rate limiting on sensitive API endpoints
 *   2. Auth guard — via NextAuth authorized() callback in auth.config.ts
 *   3. next-intl locale routing
 *
 * NOTE: Middleware always runs in the Edge Runtime (even on Cloud Run / Firebase
 * App Hosting). Keep all imports edge-compatible — no Node.js built-ins, no Prisma.
 */

import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// ─── Auth (edge-compatible config only, no Prisma) ──────────
const { auth } = NextAuth(authConfig);

// ─── i18n Middleware ─────────────────────────────────────────
const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'bn'],
  defaultLocale: 'en',
});

// ─── Rate Limiting ────────────────────────────────────────────
// In-memory Map store — works well on Cloud Run's persistent containers.
// On Vercel serverless each invocation is fresh, but Cloud Run containers
// stay alive, so this actually provides real rate limiting without Redis.
//
// Config format: [maxRequests, windowSeconds]
const RATE_LIMIT_RULES: Record<string, [number, number]> = {
  '/api/auth':           [20,  60],  // 20 auth attempts / min
  '/api/firebase/token': [60,  60],  // 60 Firebase token requests / min
  '/api/upload':         [10, 300],  // 10 uploads / 5 min
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
  entry.count++;
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

// ─── Main Middleware ──────────────────────────────────────────
export default auth(async (req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // 1. Rate limiting (API routes only)
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

  // 2. Auth guard is handled declaratively by authConfig.callbacks.authorized()
  //    (called by NextAuth's auth() wrapper above before we even reach here for
  //    protected pages — any redirect is issued automatically)

  // 3. i18n routing
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // All routes except Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
