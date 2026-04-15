/**
 * Sentry — Server-side Configuration
 *
 * This file is loaded automatically by @sentry/nextjs on the server.
 * Run `npx @sentry/wizard@latest -i nextjs` to complete setup.
 *
 * Install: npm install @sentry/nextjs
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',

    // Capture 10 % of transactions for performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Only enable in production (avoids Sentry quota during local dev)
    enabled: process.env.NODE_ENV === 'production',

    // Ignore known noisy errors
    ignoreErrors: [
      'NEXT_NOT_FOUND',      // Next.js notFound() — not a real error
      'NEXT_REDIRECT',       // Next.js redirect() — not a real error
      'AbortError',          // Client navigated away mid-request
    ],

    beforeSend(event) {
      // Strip PII from error contexts
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[Sentry] SENTRY_DSN is not set — errors will not be captured.');
}
