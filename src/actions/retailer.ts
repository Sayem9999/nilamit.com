'use server';

import { auth } from '@/lib/auth';
import { RetailerService, RetailerStats } from '@/services/retailer/retailer-service';
import { ErrorType, errorResponse, ServiceResponse } from '@/lib/errors';
import { ERROR_CODES } from '@/lib/constants';

export async function getRetailerStats(): Promise<ServiceResponse<RetailerStats>> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);
  }

  // Only allow verified sellers, retailers, or email-verified users
  if (!session.user.isVerifiedSeller && !session.user.isRetailer && !session.user.emailVerified) {
    return errorResponse(ErrorType.FORBIDDEN, 'Retailer privileges required', ERROR_CODES.FORBIDDEN);
  }

  return RetailerService.getDashboardStats(session.user.id);
}
