import * as Sentry from '@sentry/nextjs';
import type { SentryArea, SentrySeverity } from './sentry-tags';

/**
 * Structured Production Logger
 * Provides categorized logging with automatic Sentry integration for errors.
 *
 * Pass `area` and/or `severity` in the context object to tag the captured
 * Sentry event so the alert rules in `docs/SENTRY_ALERTS.md` can filter on it:
 *
 *   log.error('placeBid failed', err, { userId, area: 'bid', severity: 'critical' });
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  auctionId?: string;
  bidId?: string;
  path?: string;
  /** Functional area for Sentry alert rule filtering. See sentry-tags.ts. */
  area?: SentryArea;
  /** Alert severity for Sentry alert rule filtering. See sentry-tags.ts. */
  severity?: SentrySeverity;
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ctx: ${JSON.stringify(context)}` : '';
  return `[${level.toUpperCase()}] ${timestamp}: ${message}${contextStr}`;
}

/**
 * Run `fn` inside a Sentry scope that has area + severity tags applied
 * when present in the context. No-op outside of production.
 */
function withSentryTags(context: LogContext | undefined, fn: () => void): void {
  if (!IS_PRODUCTION) return;
  Sentry.withScope((scope) => {
    if (context?.area) scope.setTag('area', context.area);
    if (context?.severity) scope.setTag('severity', context.severity);
    fn();
  });
}

export const log = {
  info: (message: string, context?: LogContext) => {
    console.log(formatMessage('info', message, context));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage('warn', message, context));
    withSentryTags(context, () => {
      Sentry.captureMessage(message, { level: 'warning', extra: context });
    });
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    console.error(formatMessage('error', message, context), error);
    withSentryTags(context, () => {
      Sentry.captureException(error || new Error(message), {
        extra: { message, ...context },
      });
    });
  },

  debug: (message: string, context?: LogContext) => {
    if (!IS_PRODUCTION) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  /**
   * Performance tracking wrapper
   */
  time: async <T>(label: string, fn: () => Promise<T>, context?: LogContext): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = (performance.now() - start).toFixed(2);
      log.info(`${label} - Success`, { ...context, durationMs: duration });
      return result;
    } catch (error) {
      const duration = (performance.now() - start).toFixed(2);
      log.error(`${label} - Failed`, error, { ...context, durationMs: duration });
      throw error;
    }
  }
};
