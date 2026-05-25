'use server';

import { db, newId } from '@/lib/db';
import { auth } from '@/lib/auth';
import { filterPII } from '@/lib/pii-filter';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

const MAX_BULK_ROWS    = 1000;
const BATCH_SIZE       = 499; // Firestore max is 500 ops per batch

import { BulkAuctionSchema, type BulkAuctionInput } from '@/lib/inventory-parser';

export async function processBulkUpload(fileName: string, rows: BulkAuctionInput[]): Promise<ServiceResponse<{ processed: number, errors: string[] }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  if (rows.length > MAX_BULK_ROWS) {
    return errorResponse(ErrorType.VALIDATION, `Bulk upload limited to ${MAX_BULK_ROWS} rows per file.`);
  }

  const userSnap = await db.collection('users').doc(session.user.id).get();
  const userData = userSnap.data();
  if (!userData?.isVerifiedSeller && !userData?.emailVerified) {
    return errorResponse(ErrorType.FORBIDDEN, 'Only verified sellers can bulk upload.');
  }

  const opId  = newId();
  const now   = new Date();
  const opRef = db.collection('bulkOperations').doc(opId);

  await opRef.set({
    id: opId, sellerId: session.user.id, status: 'PROCESSING',
    fileName, totalRows: rows.length, processedRows: 0, errors: [], createdAt: now, updatedAt: now,
  });

  let processed = 0;
  const errors: string[] = [];

  let batch     = db.batch();
  let batchCount = 0;

  for (const [i, row] of rows.entries()) {
    try {
      const parsed = BulkAuctionSchema.safeParse(row);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
      }
      const validatedRow = parsed.data;

      const auctionId = newId();
      const rowNow    = new Date();
      const auctionRef = db.collection('auctions').doc(auctionId);

      batch.set(auctionRef, {
        id: auctionId,
        title:            filterPII(validatedRow.title),
        description:      filterPII(validatedRow.description),
        category:         validatedRow.category,
        startingPrice:    validatedRow.startingPrice,
        currentPrice:     validatedRow.startingPrice,
        minBidIncrement:  validatedRow.minIncrement || 100,
        images:           validatedRow.images || [],
        startTime:        rowNow,
        endTime:          new Date(rowNow.getTime() + (validatedRow.durationHours || 24) * 3_600_000),
        status:           'ACTIVE',
        sellerId:         session.user.id,
        sellerName:       userData.name || 'Verified Seller',
        winnerId:         null,
        isFeatured:       false,
        wasExtended:      false,
        commissionEarned: null,
        deliveryCharge:   0,
        deliveryStatus:   'PENDING',
        trackingNumber:   null,
        bidCount:         0,
        reservePrice:     validatedRow.reservePrice || null,
        buyItNowPrice:    validatedRow.buyNowPrice || null,
        location:         validatedRow.location || 'Dhaka',
        createdAt:        rowNow,
        updatedAt:        rowNow,
      });

      batchCount++;
      processed++;

      if (batchCount === BATCH_SIZE) {
        await batch.commit();
        batch      = db.batch();
        batchCount = 0;
        await opRef.update({ processedRows: processed, updatedAt: new Date() });
      } else if (processed % 50 === 0) {
        await opRef.update({ processedRows: processed, updatedAt: new Date() });
      }
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Commit any remaining items in the last partial batch
  if (batchCount > 0) {
    try {
      await batch.commit();
    } catch (e) {
      log.error('[bulk-upload] final batch commit failed', e);
      errors.push(`Final batch commit failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  const finalStatus = errors.length === rows.length ? 'FAILED'
    : errors.length > 0 ? 'PARTIAL'
    : 'COMPLETED';

  await opRef.update({ status: finalStatus, processedRows: processed, errors, updatedAt: new Date() });

  return successResponse({ processed, errors });
}

export async function getBulkOperations(): Promise<ServiceResponse<unknown[]>> {
  const session = await auth();
  if (!session?.user?.id) return successResponse([]);

  try {
    const snap = await db.collection('bulkOperations')
      .where('sellerId', '==', session.user.id)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const data = snap.docs.map((d) => ({
      ...d.data(), id: d.id,
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt),
      updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(d.data().updatedAt),
    }));
    return successResponse(data);
  } catch (e) {
    log.error('[bulk-upload] getBulkOperations failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch bulk operations');
  }
}
