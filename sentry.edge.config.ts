/**
 * Sentry — Edge Runtime Configuration
 *
 * Loaded by @sentry/nextjs for Edge API routes and middleware.
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent, scrubBreadcrumb } from './src/lib/sentry-scrub';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
    enabled: process.env.NODE_ENV === 'production',
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
