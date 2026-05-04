'use server';

import { requireAdmin } from '@/lib/admin-guard';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { AdminService } from '@/services/admin/admin-service';

/**
 * Admin Dashboard Core Stats
 * Entrance point via Server Action; logic delegated to AdminService.
 */
export async function getAdminStats(): Promise<ServiceResponse<unknown>> {
  await requireAdmin();

  try {
    const stats = await AdminService.getDashboardStats();
    return successResponse(stats);
  } catch (e: unknown) {
    const error = e as { type?: ErrorType; message: string };
    return errorResponse(error.type || ErrorType.INTERNAL, error.message);
  }
}
