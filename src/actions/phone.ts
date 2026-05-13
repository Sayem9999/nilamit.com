'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { normalizePhone } from '@/lib/utils';
import {
  emailOtpSendLimiter,
} from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import crypto from 'crypto';

const OTP_EXPIRY_MS        = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_OTP_PER_HOUR     = 5;

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOTP(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

export async function sendEmailOTP(email: string) {
  const normalized = email.trim().toLowerCase();

  // Per-address rate limit — prevents inbox-bombing and Resend budget exhaustion
  const sendGate = await emailOtpSendLimiter.limit(`email_send_${normalized}`);
  if (!sendGate.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many OTP requests. Try again in an hour.');
  }

  const otp        = generateOTP();
  const hashedOTP  = hashOTP(otp);   // store hash, not plaintext
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const rateSnap = await db.collection('verificationTokens')
    .where('identifier', '==', normalized)
    .where('expires', '>', oneHourAgo)
    .get();
  if (rateSnap.size >= MAX_OTP_PER_HOUR) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many OTP requests. Try again in an hour.');
  }

  // Doc ID uses the hash — doc ID is observable in error messages and logs,
  // so we never embed the raw OTP there.
  const tokenId = `${normalized}__${hashedOTP}`;
  await db.collection('verificationTokens').doc(tokenId).set({
    identifier: normalized,
    token:      hashedOTP,    // hashed, matches what resetPasswordWithOTP will query
    expires:    new Date(Date.now() + OTP_EXPIRY_MS),
  });

  try {
    const { sendEmail } = await import('@/lib/firebase-email');
    await sendEmail({
      to: normalized,
      subject: 'Your nilamit.com Login Code',
      html: `<p>Your code: <strong>${otp}</strong> — valid 5 minutes.</p>`,
    });
    return successResponse(null);
  } catch (e) {
    log.error('[phone] sendEmailOTP failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to send email.');
  }
}

export async function syncVerifiedPhoneNatively(phone: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

    const normalizedPhone = normalizePhone(phone);
    if (!/^\+8801\d{9}$/.test(normalizedPhone)) {
      return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladesh phone number.');
    }

    // Check if phone number is already verified by another user in our Firestore DB
    const existingSnap = await db.collection('users')
      .where('phone', '==', normalizedPhone)
      .where('isPhoneVerified', '==', true)
      .limit(1).get();
    if (!existingSnap.empty && existingSnap.docs[0].id !== session.user.id) {
      return errorResponse(ErrorType.CONFLICT, 'This phone number is already verified by another account.');
    }

    // Fetch user record from Firebase Auth to verify they actually successfully linked the phone number!
    const { adminAuth } = await import('@/lib/firebase-admin');
    const userRecord = await adminAuth.instance.getUser(session.user.id);
    if (!userRecord.phoneNumber) {
      return errorResponse(ErrorType.VALIDATION, 'Phone number is not verified in Firebase Auth.');
    }

    const firebasePhoneNormalized = normalizePhone(userRecord.phoneNumber);
    if (firebasePhoneNormalized !== normalizedPhone) {
      return errorResponse(ErrorType.VALIDATION, 'The verified phone number does not match the input phone number.');
    }

    // Update Firestore user document
    await db.collection('users').doc(session.user.id).update({
      phone: normalizedPhone,
      isPhoneVerified: true,
      updatedAt: new Date(),
    });

    return successResponse(null);
  } catch (error) {
    log.error('[phone] syncVerifiedPhoneNatively failed', error);
    return errorResponse(ErrorType.INTERNAL, 'Failed to verify phone number. Please try again.');
  }
}
