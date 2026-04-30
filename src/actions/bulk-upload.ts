'use server';

import { z } from 'zod';
import { db, newId } from '@/lib/db';
import { auth } from '@/lib/auth';
import { filterPII } from '@/lib/pii-filter';
import { CATEGORIES } from '@/types';
import { log } from '@/lib/logger';

const VALID_CATEGORIES = CATEGORIES.map((c) => c.slug);
const MAX_BULK_ROWS    = 1000;
const BATCH_SIZE       = 499; // Firestore max is 500 ops per batch

const BulkRowSchema = z.object({
  title:         z.string().min(3).max(100),
  description:   z.string().min(10).max(2000),
  category:      z.string().refine((v) => VALID_CATEGORIES.includes(v as never), 'Invalid category'),
  startingPrice: z.number().positive().max(10_000_000),
  durationHours: z.number().positive().max(720),
});

type BulkUploadRow = z.infer<typeof BulkRowSchema>;

export async function processBulkUpload(fileName: string, rows: BulkUploadRow[]) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  if (rows.length > MAX_BULK_ROWS) {
    return { success: false, error: `Bulk upload limited to ${MAX_BULK_ROWS} rows per file.` };
  }

  const userSnap = await db.collection('users').doc(session.user.id).get();
  if (!userSnap.data()?.isVerifiedSeller) {
    return { success: false, error: 'Only verified sellers can bulk upload.' };
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

  // Use Firestore batch writes — reduces 1000 sequential round-trips to ~2 batch commits
  let batch     = db.batch();
  let batchCount = 0;

  for (const [i, row] of rows.entries()) {
    const validation = BulkRowSchema.safeParse(row);
    if (!validation.success) {
      errors.push(`Row ${i + 1}: ${validation.error.issues[0]?.message}`);
      continue;
    }

    try {
      const auctionId = newId();
      const rowNow    = new Date();
      const auctionRef = db.collection('auctions').doc(auctionId);

      batch.set(auctionRef, {
        id: auctionId,
        title:            filterPII(row.title),
        description:      filterPII(row.description),
        category:         row.category,
        startingPrice:    row.startingPrice,
        currentPrice:     row.startingPrice,
        minBidIncrement:  10,
        images:           [],
        startTime:        rowNow,
        endTime:          new Date(rowNow.getTime() + row.durationHours * 3_600_000),
        status:           'ACTIVE',
        sellerId:         session.user.id,
        winnerId:         null,
        isFeatured:       false,
        wasExtended:      false,
        commissionRate:   0,
        commissionEarned: null,
        deliveryCharge:   0,
        deliveryStatus:   'PENDING',
        trackingNumber:   null,
        bidCount:         0,
        reservePrice:     null,
        buyItNowPrice:    null,
        location:         null,
        createdAt:        rowNow,
        updatedAt:        rowNow,
      });

      batchCount++;
      processed++;

      // Commit in chunks of BATCH_SIZE and update progress every 50 rows
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

  return { success: true, processed, errors };
}

export async function getBulkOperations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const snap = await db.collection('bulkOperations')
    .where('sellerId', '==', session.user.id)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  return snap.docs.map((d) => ({
    ...d.data(), id: d.id,
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt),
    updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(d.data().updatedAt),
  }));
}
