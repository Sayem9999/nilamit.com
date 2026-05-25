'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const settingsSchema = z.object({
  businessName: z.string().max(100).optional(),
  businessLocation: z.string().max(100).optional(),
  bkashNumber: z.string().regex(/^(\+8801|01)[3-9]\d{8}$/, 'Invalid bKash number').or(z.literal('')).optional(),
  nagadNumber: z.string().regex(/^(\+8801|01)[3-9]\d{8}$/, 'Invalid Nagad number').or(z.literal('')).optional(),
  bio: z.string().max(500).optional(),
});

export async function updateRetailerSettings(input: unknown): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map(i => i.message).join(', ');
    return errorResponse(ErrorType.VALIDATION, errorMsg);
  }

  try {
    const data = parsed.data;
    const cleanData: Record<string, string | null | Date> = {};
    if (data.businessName !== undefined) cleanData.businessName = data.businessName;
    if (data.businessLocation !== undefined) cleanData.businessLocation = data.businessLocation;
    if (data.bkashNumber !== undefined) cleanData.bkashNumber = data.bkashNumber || null;
    if (data.nagadNumber !== undefined) cleanData.nagadNumber = data.nagadNumber || null;
    if (data.bio !== undefined) cleanData.bio = data.bio || null;

    cleanData.updatedAt = new Date();

    await db.collection('users').doc(session.user.id).update(cleanData);
    revalidatePath('/retailer/dashboard');
    revalidatePath('/retailer/settings');
    return successResponse(null);
  } catch (e) {
    log.error('[Action] updateRetailerSettings failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to update business settings.');
  }
}

export async function toggleRetailerUpgrade(isRetailer: boolean): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    await db.collection('users').doc(session.user.id).update({
      isRetailer,
      updatedAt: new Date()
    });
    revalidatePath('/retailer/dashboard');
    revalidatePath('/retailer/settings');
    revalidatePath('/retailer/perks');
    return successResponse(null);
  } catch (e) {
    log.error('[Action] toggleRetailerUpgrade failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to upgrade seller tier.');
  }
}
