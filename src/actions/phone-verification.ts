'use server';

/**
 * Firebase phone-OTP verification — server half.
 *
 * Flow (client half: components/verification/PhoneVerificationCard.tsx):
 *   1. Client signs into Firebase with the session-bound custom token
 *      (ensureFirebaseAuth — UID === NextAuth user id).
 *   2. Client runs Firebase Phone Auth (invisible reCAPTCHA → SMS → code),
 *      which LINKS the phone number to that same Firebase user.
 *   3. Client sends a fresh ID token here. We verify it with the Admin SDK,
 *      require token.uid === session.user.id (so a token from any other
 *      account can't verify this one), extract the SMS-proven phone_number,
 *      enforce uniqueness, and flip the user's verified flags.
 *
 * SMS delivery, code generation, and replay protection are Firebase Auth's —
 * no OTP is generated or stored on our side (CLAUDE.md rule 5 satisfied by
 * construction).
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminAuth } from '@/lib/firebase-admin';
import { mfsOtpVerifyLimiter } from '@/lib/ratelimit';
import { normalizeBdPhone } from '@/lib/phone';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export interface PhoneStatus {
  phoneNumber: string | null;
  isPhoneVerified: boolean;
}

/** Current user's phone-verification state (reads the user doc — the JWT
 *  doesn't carry phone fields). */
export async function getPhoneVerificationStatus(): Promise<ServiceResponse<PhoneStatus>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  try {
    const snap = await db.collection('users').doc(session.user.id).get();
    const u = snap.data() || {};
    return successResponse({
      phoneNumber: (u.phoneNumber as string | undefined) ?? null,
      isPhoneVerified: Boolean(u.isPhoneVerified) || u.phoneVerified != null,
    });
  } catch (err) {
    log.error('[phone] status read failed', err, { userId: session.user.id });
    return errorResponse(ErrorType.INTERNAL, 'Could not load phone status');
  }
}

/**
 * Confirm a completed Firebase phone verification. `idToken` must be a fresh
 * Firebase ID token for THIS session's user, carrying a phone_number claim.
 */
export async function confirmPhoneVerification(
  idToken: string,
): Promise<ServiceResponse<{ phoneNumber: string }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  const userId = session.user.id;

  // Fail-closed limiter — verification mutates trust state.
  const gate = await mfsOtpVerifyLimiter.limit(`phone_confirm_${userId}`);
  if (!gate.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many attempts. Please wait 15 minutes.');
  }

  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 4096) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid verification token');
  }

  try {
    const decoded = await adminAuth.instance.verifyIdToken(idToken, true /* checkRevoked */);

    // Binding: the token must belong to the signed-in account. Our custom-token
    // flow guarantees Firebase UID === NextAuth user id.
    if (decoded.uid !== userId) {
      log.warn('[phone] token/session uid mismatch', { userId, tokenUid: decoded.uid, area: 'auth', severity: 'warning' });
      return errorResponse(ErrorType.FORBIDDEN, 'Verification token does not match your account');
    }

    const rawPhone = decoded.phone_number;
    if (!rawPhone) {
      return errorResponse(ErrorType.VALIDATION, 'No verified phone number on this account yet');
    }

    const phoneNumber = normalizeBdPhone(rawPhone) ?? rawPhone; // non-BD numbers kept as-is (E.164 from Firebase)

    // Uniqueness — one verified account per phone number.
    const dupSnap = await db
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(5)
      .get();
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
    log.info('[phone] verified', { userId });
    revalidatePath('/dashboard');
    return successResponse({ phoneNumber });
  } catch (err) {
    log.error('[phone] confirm failed', err, { userId, area: 'auth', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'Phone verification failed. Please try again.');
  }
}
