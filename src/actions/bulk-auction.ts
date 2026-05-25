'use server';

import { auth } from '@/lib/auth';
import { BulkAuctionService } from '@/services/auction/bulk-auction-service';
import { ErrorType, errorResponse, ServiceResponse } from '@/lib/errors';
import { ERROR_CODES } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

export async function bulkCreateAuctions(items: unknown[]): Promise<ServiceResponse<{ successCount: number; failureCount: number; errors: { index: number; error: string; details?: unknown }[] }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  if (!session.user.isVerifiedSeller && !session.user.isRetailer && !session.user.emailVerified) {
    return errorResponse(ErrorType.FORBIDDEN, 'Bulk upload requires verified seller status.');
  }

  const result = await BulkAuctionService.createBatch(items, session.user.id);
  
  if (result.success) {
    revalidatePath('/auctions');
    revalidatePath('/retailer/dashboard');
  }

  return result;
}
