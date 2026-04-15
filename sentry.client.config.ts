/**
 * Sentry — Client-side Configuration
 *
 * This file is loaded automatically by @sentry/nextjs in the browser bundle.
 *
 * Install: npm install @sentry/nextjs
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',

    // Lower sample rate on client — most errors bubble to server anyway
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    replaysSessionSampleRate: 0,     // No session replays (privacy)
    replaysOnErrorSampleRate: 0.1,   // Capture replay only on error

    enabled: process.env.NODE_ENV === 'production',

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',  // Browser quirk — not actionable
      'ChunkLoadError',                      // User navigated away mid-chunk-load
      'Network request failed',              // User offline
    ],
  });
}
