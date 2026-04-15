/**
 * Nilamit Logger
 *
 * Lightweight structured logger that wraps console and optionally forwards
 * errors to Sentry (when SENTRY_DSN is configured).
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('User placed bid', { userId, auctionId, amount });
 *   log.error('Bid failed', error, { userId, auctionId });
 *   log.warn('SMS gateway timeout', { provider, phone });
 */

type LogContext = Record<string, unknown>;

function formatMessage(level: string, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString();
  const ctxStr    = ctx ? ` ${JSON.stringify(ctx)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${ctxStr}`;
}

/**
 * Capture exception via Sentry if available.
 * Sentry is loaded lazily so it doesn't add to the initial bundle.
 */
async function captureToSentry(error: Error, ctx?: LogContext): Promise<void> {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.withScope((scope) => {
      if (ctx) {
        scope.setExtras(ctx as Record<string, unknown>);
      }
      Sentry.captureException(error);
    });
  } catch {
    // Sentry not installed — silently skip
  }
}

export const log = {
  info(message: string, ctx?: LogContext) {
    console.log(formatMessage('info', message, ctx));
  },

  warn(message: string, ctx?: LogContext) {
    console.warn(formatMessage('warn', message, ctx));
  },

  /**
   * Logs an error to console AND forwards to Sentry (non-blocking).
   * @param message  Human-readable label
   * @param error    The caught exception (or any value)
   * @param ctx      Additional key-value context (userId, auctionId, etc.)
   */
  error(message: string, error?: unknown, ctx?: LogContext) {
    const err = error instanceof Error
      ? error
      : new Error(String(error ?? 'Unknown error'));

    console.error(formatMessage('error', `${message}: ${err.message}`, ctx), err);
    captureToSentry(err, ctx).catch(() => {/* swallow — logging must never throw */});
  },

  /**
   * Log a non-exception message to Sentry as a breadcrumb/event.
   * Use for important business events (bid placed, auction sold, dispute opened).
   */
  async event(message: string, ctx?: LogContext) {
    console.log(formatMessage('event', message, ctx));

    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.addBreadcrumb({ message, data: ctx, level: 'info' });
    } catch {/* Sentry not installed */}
  },
};
