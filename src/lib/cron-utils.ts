/**
 * Shared Cron Job Utilities
 *
 * Provides:
 *  - verifyCronSecret()   — rejects unauthorised requests
 *  - withRetry()          — runs an async job with exponential backoff
 *  - cronError()          — structured JSON error response for cron failures
 */

import { NextResponse } from 'next/server';

// ─── Auth ─────────────────────────────────────────────────────
/**
 * Returns a 401 Response if the request doesn't carry the expected cron secret.
 * Returns null when the request is authorised (caller continues normally).
 *
 * Accepts the secret as either:
 *   Authorization: Bearer <CRON_SECRET>    ← Vercel Cron format
 *   x-cron-secret: <CRON_SECRET>           ← alternative header
 */
export function verifyCronSecret(req: Request): Response | null {
  // Skip auth check in development
  if (process.env.NODE_ENV !== 'production') return null;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET env var is not set — blocking all cron requests in production');
    return new Response('Service misconfigured', { status: 500 });
  }

  const authHeader     = req.headers.get('authorization');
  const secretHeader   = req.headers.get('x-cron-secret');
  const expectedBearer = `Bearer ${cronSecret}`;

  if (authHeader !== expectedBearer && secretHeader !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  return null; // Authorised
}

// ─── Retry ────────────────────────────────────────────────────
interface RetryOptions {
  maxAttempts?: number;        // Default: 3
  initialDelayMs?: number;     // Default: 1000
  backoffMultiplier?: number;  // Default: 2 (exponential)
}

interface RetryResult<T> {
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Runs `fn` up to `maxAttempts` times with exponential backoff.
 * Resolves with the first success; resolves with the last error after all retries.
 *
 * Note: Always resolves (never rejects) so callers can decide how to handle failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxAttempts    = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fn();
      return { data, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[Cron Retry ${attempt}/${maxAttempts}] ${lastError.message}`);

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay *= backoffMultiplier;
      }
    }
  }

  return { error: lastError, attempts: maxAttempts };
}

// ─── Response helpers ─────────────────────────────────────────
export function cronSuccess(data: Record<string, unknown>) {
  return NextResponse.json({ success: true, ...data });
}

export function cronError(message: string, status = 500) {
  console.error(`[Cron] Error: ${message}`);
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─── Internal ─────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
