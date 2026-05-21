/**
 * Shared Cron Job Utilities
 *
 * Provides:
 *  - verifyCronSecret()   — rejects unauthorised requests
 *  - withRetry()          — runs an async job with exponential backoff
 *  - cronError()          — structured JSON error response for cron failures
 */

import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

import { timingSafeEqual } from 'crypto';

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
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // Production MUST have a secret configured. Refuse to serve otherwise.
  if (isProduction && !cronSecret) {
    log.error('[Cron] CRON_SECRET env var is not set — blocking all cron requests in production');
    return new Response('Service misconfigured', { status: 500 });
  }

  // If a secret is configured (even in non-prod environments like staging),
  // ALWAYS validate it. Skipping the check just because NODE_ENV !== 'production'
  // means any internet-reachable preview environment exposes cron endpoints.
  if (cronSecret) {
    const authHeader     = req.headers.get('authorization');
    const secretHeader   = req.headers.get('x-cron-secret');
    const secrets        = cronSecret.split(',').map(s => s.trim()).filter(Boolean);

    if (secrets.length === 0) {
      log.error('[Cron] CRON_SECRET env var is set but resulted in no valid secrets');
      return new Response('Service misconfigured', { status: 500 });
    }

    const safeCompare = (a: string | null, b: string): boolean => {
      if (!a) return false;
      try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) return false;
        return timingSafeEqual(bufA, bufB);
      } catch {
        return false;
      }
    };

    let isAuthorized = false;
    for (const secret of secrets) {
      const expectedBearer = `Bearer ${secret}`;
      if (safeCompare(authHeader, expectedBearer) || safeCompare(secretHeader, secret)) {
        isAuthorized = true;
        break;
      }
    }

    if (!isAuthorized) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  return null; // Authorised (or local dev with no secret configured)
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
      log.error(`[Cron Retry ${attempt}/${maxAttempts}] ${lastError.message}`, lastError);

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
  log.error(`[Cron] Error: ${message}`);
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─── Internal ─────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
