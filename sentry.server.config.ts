/**
 * Sentry — Server-side Configuration
 *
 * This file is loaded automatically by @sentry/nextjs on the server.
 * Run `npx @sentry/wizard@latest -i nextjs` to complete setup.
 *
 * Install: npm install @sentry/nextjs
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent, scrubBreadcrumb } from './src/lib/sentry-scrub';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',

    // Capture 10 % of transactions for performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Only enable in production (avoids Sentry quota during local dev)
    enabled: process.env.NODE_ENV === 'production',

    // Don't send IPs / cookies / etc. by default; the scrubber below assumes
    // this is off, but we belt-and-brace.
    sendDefaultPii: false,

    // Ignore known noisy errors
    ignoreErrors: [
      'NEXT_NOT_FOUND',      // Next.js notFound() — not a real error
      'NEXT_REDIRECT',       // Next.js redirect() — not a real error
      'AbortError',          // Client navigated away mid-request
    ],

    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[Sentry] SENTRY_DSN is not set — errors will not be captured.');
}
