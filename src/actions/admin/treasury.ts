'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import { batchHydrateEscrowRows, type AdminEscrowDoc } from './shared';

/**
 * Recent automated escrow transactions for the treasury audit table.
 * Filters to states where money has actually moved (HELD / RELEASED).
 */
export async function getTreasuryAudit() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', 'in', ['HELD', 'RELEASED'])
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (_e) {
    log.error('[admin] getTreasuryAudit failed', _e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch treasury audit');
  }
}

/**
 * Currently HELD escrows — surfaced in TreasuryTab for admin manual override.
 */
export async function getAdminActiveEscrows() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', '==', 'HELD')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (_e) {
    log.error('[admin] getAdminActiveEscrows failed', _e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch active escrows');
  }
}
