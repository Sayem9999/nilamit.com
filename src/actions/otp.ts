'use server';

import { db } from '@/lib/db';
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
    log.error('[otp] sendEmailOTP failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to send email.');
  }
}
