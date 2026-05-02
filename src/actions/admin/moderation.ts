'use server';

import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import { AdminService } from '@/services/admin/admin-service';

/**
 * Toggle a user's verified-seller flag.
 * Entrance point; delegates update and logging to AdminService.
 */
export async function adminToggleVerification(userId: string, reason: string) {
  const session = await requireAdmin();
  
  try {
    const result = await AdminService.toggleUserVerification(session.user.id, userId, reason);
    revalidatePath('/admin');
    return successResponse(result);
  } catch (e: unknown) {
    const error = e as { type?: ErrorType; message: string };
    return errorResponse(error.type || ErrorType.INTERNAL, error.message);
  }
}
