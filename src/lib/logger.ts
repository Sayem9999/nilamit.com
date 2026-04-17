/**
 * Nilamit Logger
 *
 * Lightweight structured logger that wraps console. Sentry integration is
 * deferred — when @sentry/nextjs is installed, swap captureToSentry to
 * dynamically import it.
 */

type LogContext = Record<string, unknown>;

function formatMessage(level: string, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString();
  const ctxStr    = ctx ? ` ${JSON.stringify(ctx)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${ctxStr}`;
}

export const log = {
  info(message: string, ctx?: LogContext) {
    console.log(formatMessage('info', message, ctx));
  },

  warn(message: string, ctx?: LogContext) {
    console.warn(formatMessage('warn', message, ctx));
  },

  /**
   * Logs an error to console.
   * @param message  Human-readable label
   * @param error    The caught exception (or any value)
   * @param ctx      Additional key-value context (userId, auctionId, etc.)
   */
  error(message: string, error?: unknown, ctx?: LogContext) {
    const err = error instanceof Error
      ? error
      : new Error(String(error ?? 'Unknown error'));

    console.error(formatMessage('error', `${message}: ${err.message}`, ctx), err);
  },

  /**
   * Log a non-exception business event.
   */
  event(message: string, ctx?: LogContext) {
    console.log(formatMessage('event', message, ctx));
  },
};
