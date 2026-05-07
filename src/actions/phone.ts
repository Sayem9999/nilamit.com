'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { normalizePhone } from '@/lib/utils';
import { getSMSGateway } from '@/lib/sms-gateway';
import {
  phoneOtpSendLimiter,
  phoneOtpVerifyLimiter,
  emailOtpSendLimiter,
} from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import crypto from 'crypto';

const OTP_EXPIRY_MS        = 5 * 60 * 1000;
const MAX_ATTEMPTS         = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_OTP_PER_HOUR     = 5;

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOTP(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

export async function sendPhoneOTP(phone: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'You must be logged in.');

  const normalizedPhone = normalizePhone(phone);
  if (!/^\+8801\d{9}$/.test(normalizedPhone)) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladesh phone number.');
  }

  // Block if already verified by a *different* account
  const existingSnap = await db.collection('users')
    .where('phone', '==', normalizedPhone)
    .where('isPhoneVerified', '==', true)
    .limit(1).get();
  if (!existingSnap.empty && existingSnap.docs[0].id !== session.user.id) {
    return errorResponse(ErrorType.CONFLICT, 'This phone number is already verified by another account.');
  }

  return internalSendOTP(normalizedPhone, session.user.id, session.user.email ?? undefined);
}

export async function requestStandaloneOTP(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!/^\+8801\d{9}$/.test(normalizedPhone)) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladesh phone number.');
  }
  return internalSendOTP(normalizedPhone);
}

async function internalSendOTP(phone: string, userId?: string, email?: string) {
  // Per-phone rate limit — prevents SMS budget exhaustion and victim harassment
  const sendGate = await phoneOtpSendLimiter.limit(`phone_send_${phone}`);
  if (!sendGate.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many OTP requests. Please try again in an hour.');
  }

  // Belt-and-braces Firestore check in case Redis is wiped
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const rateSnap   = await db.collection('phoneVerifications')
    .where('phone', '==', phone)
    .where('createdAt', '>', oneHourAgo)
    .get();
  if (rateSnap.size >= MAX_OTP_PER_HOUR) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many OTP requests. Please try again in an hour.');
  }

  const otp       = generateOTP();
  const hashedOTP = hashOTP(otp);
  const ref       = db.collection('phoneVerifications').doc();
  const now       = new Date();

  await ref.set({
    id: ref.id, userId: userId ?? null, phone, otp: hashedOTP,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    verified: false, attempts: 0, createdAt: now,
  });

  const smsResult = await getSMSGateway().sendSMS(
    phone, `Your nilamit.com verification code is: ${otp}. Valid for 5 minutes.`
  );

  let emailSent = false;
  if (email) {
    try {
      const { sendEmail } = await import('@/lib/firebase-email');
      await sendEmail({
        to: email,
        subject: 'Your Verification Code',
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>Verifies ${phone}. Valid 5 minutes.</p>`,
      });
      emailSent = true;
    } catch (e) { log.error('[phone] Firebase email fallback failed', e); }
  }

  if (!smsResult.success && !emailSent) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to send OTP. Please try again later.');
  }
  return successResponse({ message: 'OTP sent successfully.' });
}

export async function verifyPhoneOTP(phone: string, otp: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'You must be logged in.');

  // Always normalize before querying and storing — consistent with sendPhoneOTP
  const normalizedPhone = normalizePhone(phone);

  const result = await internalVerifyOTP(normalizedPhone, otp, session.user.id);
  if (!result.success) return result;

  await db.collection('users').doc(session.user.id).update({
    phone: normalizedPhone,   // store normalized form so phone-login queries match
    isPhoneVerified: true,
    updatedAt: new Date(),
  });
  return successResponse(null);
}

export async function verifyStandaloneOTP(phone: string, otp: string) {
  return internalVerifyOTP(normalizePhone(phone), otp);
}

async function internalVerifyOTP(phone: string, otp: string, userId?: string) {
  // Cap attempts per phone — prevents brute-force of 6-digit OTP space
  const verifyGate = await phoneOtpVerifyLimiter.limit(`phone_verify_${phone}`);
  if (!verifyGate.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many verification attempts. Please request a new code.');
  }

  const hashedOTP = hashOTP(otp);
  const now       = new Date();

  // 1. Fetch the latest pending verification doc for this phone number
  let query: FirebaseFirestore.Query = db.collection('phoneVerifications')
    .where('phone', '==', phone)
    .where('verified', '==', false);
  if (userId) query = query.where('userId', '==', userId);
  query = query.orderBy('createdAt', 'desc').limit(1);

  const snap = await query.get();

  if (snap.empty) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid or expired OTP.');
  }

  const latestDoc = snap.docs[0];
  const latestData = latestDoc.data();

  // 2. Enforce MAX_ATTEMPTS
  if ((latestData.attempts ?? 0) >= MAX_ATTEMPTS) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many verification attempts. Please request a new code.');
  }

  // 3. Check expiration
  const { toDate: fsToDate } = await import('@/lib/db');
  if (fsToDate(latestData.expiresAt) < now) {
    return errorResponse(ErrorType.VALIDATION, 'Verification code has expired.');
  }

  // 4. Verify OTP hash
  if (latestData.otp !== hashedOTP) {
    await latestDoc.ref.update({
      attempts: (latestData.attempts ?? 0) + 1
    });
    return errorResponse(ErrorType.VALIDATION, 'Invalid or expired OTP.');
  }

  // Delete on consumption — spent OTPs have no audit value and bloat rate-limit queries
  await latestDoc.ref.delete();
  return successResponse(null);
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
