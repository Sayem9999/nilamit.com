/**
 * POST /api/cron/process-auctions
 *
 * Finds ACTIVE auctions whose endTime has passed and transitions them:
 *   - No bids  → EXPIRED
 *   - Has bids → SOLD + creates EscrowTransaction (PENDING) + notifies winner
 *
 * All logic is handled by closeAllEndedAuctions() which uses Firestore
 * transactions and processAuctionSale() for correct commission calculation,
 * reserve-price enforcement, and atomic escrow creation.
 *
 * NOTE: /api/cron/close-auctions performs the same job. Run only one of these
 * from your scheduler. This route exists for backwards-compatibility with any
 * existing Cloud Scheduler jobs pointing to /api/cron/process-auctions.
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { closeAllEndedAuctions } from '@/lib/auction-logic';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(
    async () => {
      await closeAllEndedAuctions();
      return { closedAt: new Date().toISOString() };
    },
    { maxAttempts: 3, initialDelayMs: 1000 },
  );

  if (result.error) {
    Sentry.captureException(result.error, {
      tags: { component: 'cron', job: 'process-auctions' },
    });
    return cronError(`process-auctions failed after ${result.attempts} attempts: ${result.error.message}`);
  }

  return NextResponse.json({
    success:     true,
    message:     'Auctions processed successfully',
    closedAt:    result.data?.closedAt,
    attempts:    result.attempts,
  });
}
