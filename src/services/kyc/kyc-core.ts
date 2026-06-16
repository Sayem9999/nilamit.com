/**
 * kyc-core.ts — shared KYC submission logic. Used by the web action
 * (src/actions/kyc.ts) and the native bridge (/api/mobile/kyc). Server-only lib.
 */
import { db } from '@/lib/db';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { KycStatus } from '@/types';

export const SubmitKycSchema = z.object({
  nidFrontUrl: z.string().url().max(2048),
  nidBackUrl: z.string().url().max(2048),
  selfieUrl: z.string().url().max(2048).optional(),
  tradeLicenseUrl: z.string().url().max(2048).optional(),
});

export async function submitKycForUser(userId: string, input: unknown): Promise<ServiceResponse<{ status: KycStatus }>> {
  const parsed = SubmitKycSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, 'NID front + back are required');

  try {
    await db.collection('users').doc(userId).update({
      kycStatus: 'PENDING' as KycStatus,
      kycSubmittedAt: FieldValue.serverTimestamp(),
      kycDocsRef: parsed.data,
      kycRejectReason: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/dashboard');
    log.info('[kyc] submitted', { userId });
    return successResponse({ status: 'PENDING' });
  } catch (err) {
    log.error('[kyc] submit failed', err, { userId });
    return errorResponse(ErrorType.INTERNAL, 'Could not submit KYC');
  }
}
