'use server';

/**
 * Admin-only Server Actions over the logistics module.
 *
 * The actual writes live in `src/lib/logistics.ts` as internal helpers.
 * Anything reachable from the public Server Actions wire MUST require an
 * admin session — see audit notes about address PII exfiltration via the
 * pre-existing unauthenticated wrapper this file replaces.
 */

import { requireAdmin } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import {
  updateLogisticsStatus as _updateLogisticsStatus,
  LogisticsStatus,
} from '@/lib/logistics';

export { LogisticsStatus };

/**
 * Admin-only: simulate a courier-status update.
 * Real provider webhooks should land on a dedicated `/api/logistics/webhook`
 * route signed by the courier — not on this Server Action.
 */
export async function updateLogisticsStatus(
  auctionId: string,
  status: LogisticsStatus,
  note?: string,
): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();

  try {
    await _updateLogisticsStatus(auctionId, status, note);

    log.info('[Admin] Logistics status updated', {
      auctionId, status, adminId: adminSession.user.id,
    });

    return successResponse(null);
  } catch (e) {
    log.error('[logistics] Failed to update logistics status:', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Update failed');
  }
}
