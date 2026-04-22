import * as Sentry from '@sentry/nextjs';

/**
 * Structured Production Logger
 * Provides categorized logging with automatic Sentry integration for errors.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  auctionId?: string;
  bidId?: string;
  path?: string;
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ctx: ${JSON.stringify(context)}` : '';
  return `[${level.toUpperCase()}] ${timestamp}: ${message}${contextStr}`;
}

export const log = {
  info: (message: string, context?: LogContext) => {
    console.log(formatMessage('info', message, context));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage('warn', message, context));
    if (IS_PRODUCTION) {
      Sentry.captureMessage(message, { level: 'warning', extra: context });
    }
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    console.error(formatMessage('error', message, context), error);
    if (IS_PRODUCTION) {
      Sentry.captureException(error || new Error(message), {
        extra: { message, ...context },
      });
    }
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
