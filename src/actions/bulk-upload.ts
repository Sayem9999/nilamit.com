'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

/**
 * Enterprise Seller Tools - Bulk Upload
 * 
 * Implements CSV ingestion for mass item listing.
 */

interface BulkUploadRow {
  title: string;
  description: string;
  category: string;
  startingPrice: number;
  durationHours: number;
}

export async function processBulkUpload(fileName: string, rows: BulkUploadRow[]) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isVerifiedSeller) {
    return { success: false, error: "Enterprise seller status required" };
  }

  const userId = session.user.id;

  // 1. Create Operation Record
  const operation = await prisma.bulkOperation.create({
    data: {
      sellerId: userId,
      fileName,
      totalRows: rows.length,
      status: "PROCESSING"
    }
  });

  const errors: Record<number, string> = {};
  let processed = 0;

  // 2. Process Rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Basic validation
      if (!row.title || row.startingPrice <= 0) {
        throw new Error("Missing title or invalid price");
      }

      await prisma.auction.create({
        data: {
          title: row.title,
          description: row.description,
          category: row.category,
          startingPrice: row.startingPrice,
          currentPrice: row.startingPrice,
          startTime: new Date(),
          endTime: new Date(Date.now() + row.durationHours * 60 * 60 * 1000),
          sellerId: userId,
          status: AuctionStatus.ACTIVE
        }
      });
      processed++;
    } catch (error: unknown) {
      errors[i + 1] = error instanceof Error ? error.message : "Failed to create auction";
    }

    // Progress update every 10 rows
    if ((i + 1) % 10 === 0) {
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { processedRows: processed }
      });
    }
  }

  // 3. Finalize Operation
  await prisma.bulkOperation.update({
    where: { id: operation.id },
    data: {
      status: Object.keys(errors).length === 0 ? "COMPLETED" : "COMPLETED_WITH_ERRORS",
      processedRows: processed,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors: errors as any
    }
  });

  revalidatePath('/seller/inventory');
  return { success: true, processed, total: rows.length, errorCount: Object.keys(errors).length };
}

export async function getBulkOperations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.bulkOperation.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
}
