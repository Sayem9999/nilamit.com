/**
 * Sentry tagging helpers.
 *
 * The Sentry alert rules in `docs/SENTRY_ALERTS.md` filter on `area` and
 * `severity` tags. This module is the single place those tags get applied so
 * the values stay consistent — rule filters break silently if a string drifts.
 *
 * Usage from a server action / route handler:
 *   try { ... }
 *   catch (e) {
 *     tagSentryArea('bid', 'critical');
 *     Sentry.captureException(e);
 *     throw e;
 *   }
 */

import * as Sentry from '@sentry/nextjs';

/** Functional area of the codebase. Add to this union when introducing a new alert rule. */
export type SentryArea =
  | 'bid'
  | 'escrow'
  | 'auth'
  | 'cron'
  | 'upload'
  | 'admin'
  | 'chat'
  | 'dispute'
  | 'logistics'
  | 'test';

/** Alert severity. Maps directly to the rule tiers in SENTRY_ALERTS.md. */
export type SentrySeverity = 'critical' | 'warning' | 'info';

/**
 * Tag the current Sentry scope with the area + severity. Must be called
 * before `captureException` (or before the throw, if relying on the global
 * error boundary to capture).
 *
 * No-ops when SENTRY_DSN is unset or in non-production environments.
 */
export function tagSentryArea(area: SentryArea, severity: SentrySeverity = 'warning'): void {
  Sentry.getCurrentScope().setTag('area', area);
  Sentry.getCurrentScope().setTag('severity', severity);
}

/**
 * Capture an exception with the area + severity tags pre-applied. Convenience
 * wrapper around the tag-then-capture pattern.
 */
export function captureWithArea(
  error: unknown,
  area: SentryArea,
  severity: SentrySeverity = 'warning',
): void {
  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    scope.setTag('severity', severity);
    Sentry.captureException(error);
  });
}
