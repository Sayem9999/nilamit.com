import { AuctionService } from './auction-service';
import { ServiceResponse, successResponse } from '@/lib/errors';
import { createAuctionSchema } from '@/lib/schemas';
import { log } from '@/lib/logger';

export class BulkAuctionService {
  static async createBatch(items: unknown[], sellerId: string): Promise<ServiceResponse<{ successCount: number; failureCount: number; errors: { index: number; error: string; details?: unknown }[] }>> {
    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as { index: number; error: string; details?: unknown }[]
    };

    // We process in smaller batches to avoid transaction limits or timeout
    const CHUNK_SIZE = 10;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (item, index) => {
        try {
          // 1. Validate with existing schema
          const parsed = createAuctionSchema.safeParse(item);
          if (!parsed.success) {
            results.failureCount++;
            results.errors.push({ index: i + index, error: 'Validation failed', details: parsed.error.format() });
            return;
          }

          // 2. Use existing AuctionService.create (it handles global stats too)
          const res = await AuctionService.create(parsed.data, sellerId);
          if (res.success) {
            results.successCount++;
          } else {
            results.failureCount++;
            results.errors.push({ index: i + index, error: res.error?.message || 'Creation failed' });
          }
        } catch (e) {
          log.error('[BulkAuctionService] Item creation failed', e);
          results.failureCount++;
          results.errors.push({ index: i + index, error: 'Internal error' });
        }
      }));
    }

    return successResponse(results);
  }
}
