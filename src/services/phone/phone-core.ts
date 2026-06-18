/**
 * phone-core.ts — shared "mark this user's phone verified" logic. Used by the
 * web action (confirmPhoneVerification) and the native bridge
 * (/api/mobile/phone). Server-only lib.
 *
 * The CALLER is responsible for proving phone ownership (a Firebase ID token
 * carrying a phone_number claim, minted by Firebase Phone Auth). This function
 * only enforces uniqueness and writes the verified flags.
 */
import { db } from '@/lib/db';
import { normalizeBdPhone } from '@/lib/phone';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function setVerifiedPhoneForUser(
  userId: string,
  rawPhone: string,
): Promise<ServiceResponse<{ phoneNumber: string }>> {
  if (!rawPhone) return errorResponse(ErrorType.VALIDATION, 'No verified phone number on this token.');
  const phoneNumber = normalizeBdPhone(rawPhone) ?? rawPhone; // non-BD kept as E.164

  try {
    // Uniqueness — one verified account per phone number.
    const dupSnap = await db.collection('users').where('phoneNumber', '==', phoneNumber).limit(5).get();
    const takenByOther = dupSnap.docs.some(
      (d) => d.id !== userId && (d.data().isPhoneVerified || d.data().phoneVerified != null),
    );
    if (takenByOther) {
      return errorResponse(ErrorType.CONFLICT, 'This phone number is already verified on another account.');
    }

    const now = new Date();
    await db.collection('users').doc(userId).update({
      phoneNumber,
      isPhoneVerified: true,
      phoneVerified: now,
      updatedAt: now,
    });

    log.event('user_verified', { userId, metadata: { method: 'firebase_phone_otp' } });
    revalidatePath('/dashboard');
    return successResponse({ phoneNumber });
  } catch (err) {
    log.error('[phone] setVerifiedPhone failed', err, { userId, area: 'auth', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'Phone verification failed. Please try again.');
  }
}
