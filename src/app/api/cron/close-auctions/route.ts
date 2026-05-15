/**
 * POST /api/cron/close-auctions
 *
 * Closes all ACTIVE auctions whose endTime has passed.
 * Scheduled every minute by Cloud Scheduler.
 *
 * Features:
 *  - Authorization via CRON_SECRET (Bearer or x-cron-secret header)
 *  - Retry logic with exponential backoff (up to 3 attempts)
 *  - Structured success/error response
 */

import { closeAllEndedAuctions } from '@/lib/auction-logic';
import { verifyCronSecret, withRetry, cronSuccess, cronError } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1. Auth gate
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  // 2. Run with retries
  const result = await withRetry(
    async () => {
      await closeAllEndedAuctions();
      revalidatePath('/auctions');
      return { closedAt: new Date().toISOString() };
    },
    { maxAttempts: 3, initialDelayMs: 1000 }
  );

  if (result.error) {
    log.error('[Cron:close-auctions] All retries failed', result.error);
    return cronError(`close-auctions failed after ${result.attempts} attempts: ${result.error.message}`);
  }

  return cronSuccess({
    message: 'Auctions closed successfully',
    closedAt: result.data?.closedAt,
    attempts: result.attempts,
  });
}
