'use server';

import { db } from '@/lib/db';
import {
  emailOtpSendLimiter,
} from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import crypto from 'crypto';

const OTP_EXPIRY_MS = 5 * 60 * 1000;

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

  // Per-address throttling is handled by emailOtpSendLimiter (Upstash, fail-
  // closed) above — the previous Firestore range-count was a redundant indexed
  // read per request (audit finding M3) and has been removed.

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

import { auth } from '@/lib/auth';
import { bdPhoneSchema } from '@/lib/schemas';
import { sendSMS } from '@/lib/sms-gateway';
import { mfsOtpSendLimiter, mfsOtpVerifyLimiter } from '@/lib/ratelimit';
import { ServiceResponse } from '@/lib/errors';

export async function sendMFSVerificationOTP(
  type: 'bkash' | 'nagad',
  number: string,
): Promise<ServiceResponse<{ fallbackEmail: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated.');
  }

  // Validate Bangladeshi phone format
  const parsed = bdPhoneSchema.safeParse(number);
  if (!parsed.success) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladeshi mobile number.');
  }
  const normalizedNumber = parsed.data; // normalized to +8801XXXXXXXXX

  // Rate Limiting
  const limitResult = await mfsOtpSendLimiter.limit(`mfs_send_${session.user.id}`);
  if (!limitResult.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many OTP requests. Please wait before trying again.');
  }

  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);

  const tokenId = `${session.user.id}__mfs_${type}`;
  await db.collection('verificationTokens').doc(tokenId).set({
    identifier: session.user.id,
    token: hashedOTP,
    expires: new Date(Date.now() + OTP_EXPIRY_MS),
    phone: normalizedNumber,
    mfsType: type,
  });

  // Attempt SMS dispatch
  const smsResult = await sendSMS(
    normalizedNumber,
    `Your nilamit.com verification code is: ${otp}. Valid for 5 minutes.`,
  );

  if (smsResult.success) {
    return successResponse({ fallbackEmail: false });
  }

  // Secure Email Fallback
  try {
    const userSnap = await db.collection('users').doc(session.user.id).get();
    if (!userSnap.exists) {
      return errorResponse(ErrorType.NOT_FOUND, 'User not found.');
    }
    const userEmail = userSnap.data()?.email;
    if (!userEmail) {
      return errorResponse(ErrorType.NOT_FOUND, 'User email not found.');
    }

    const { sendEmail } = await import('@/lib/firebase-email');
    await sendEmail({
      to: userEmail,
      subject: `Security OTP Fallback - Link ${type.toUpperCase()}`,
      html: `<p>We tried to send a secure code via SMS to your mobile number, but the SMS gateway was unavailable.</p>
             <p>Your secure verification code is: <strong>${otp}</strong></p>
             <p>This code is valid for 5 minutes. Enter this code on the profile page to link your ${type} account.</p>`,
    });

    log.warn(`[otp] SMS gateway failed for ${normalizedNumber}. Dispatched email fallback to ${userEmail}.`);
    return successResponse({ fallbackEmail: true });
  } catch (err) {
    log.error('[otp] sendMFSVerificationOTP Email Fallback failed', err);
    return errorResponse(ErrorType.INTERNAL, 'SMS gateway failed and Email fallback failed.');
  }
}

export async function verifyAndLinkMFSAccount(
  type: 'bkash' | 'nagad',
  number: string,
  otp: string,
): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated.');
  }

  // Validate phone format
  const parsedPhone = bdPhoneSchema.safeParse(number);
  if (!parsedPhone.success) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid Bangladeshi mobile number.');
  }
  const normalizedNumber = parsedPhone.data;

  // Rate Limiting
  const limitResult = await mfsOtpVerifyLimiter.limit(`mfs_verify_${session.user.id}`);
  if (!limitResult.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many verification attempts. Please wait before trying again.');
  }

  try {
    const tokenId = `${session.user.id}__mfs_${type}`;
    const tokenRef = db.collection('verificationTokens').doc(tokenId);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return errorResponse(ErrorType.VALIDATION, 'Verification code has expired or was not requested.');
    }

    const tokenData = tokenSnap.data()!;
    const expires = tokenData.expires.toDate();
    if (expires < new Date()) {
      await tokenRef.delete();
      return errorResponse(ErrorType.VALIDATION, 'Verification code has expired. Please request a new one.');
    }

    // Verify phone matches what was requested
    if (tokenData.phone !== normalizedNumber) {
      return errorResponse(ErrorType.VALIDATION, 'Phone number does not match the verification request.');
    }

    // Verify OTP hash
    const inputHash = hashOTP(otp);
    if (inputHash !== tokenData.token) {
      return errorResponse(ErrorType.VALIDATION, 'Incorrect verification code.');
    }

    // OTP is valid! Link the number in a secure Firestore transaction (checking for duplicates first)
    const field = type === 'bkash' ? 'bkashNumber' : 'nagadNumber';
    const userRef = db.collection('users').doc(session.user.id);

    const transactionResult = await db.runTransaction(async (tx) => {
      // Check for duplicate links on other accounts
      const query = db.collection('users').where(field, '==', normalizedNumber).limit(1);
      const existing = await tx.get(query);
      if (!existing.empty && existing.docs[0].id !== session.user.id) {
        return { error: 'CONFLICT' };
      }

      // Perform transaction updates
      tx.update(userRef, {
        [field]: normalizedNumber,
        updatedAt: new Date(),
      });
      // Delete token
      tx.delete(tokenRef);

      return { success: true };
    });

    if (transactionResult.error === 'CONFLICT') {
      return errorResponse(ErrorType.CONFLICT, 'This phone number is already linked to another account.');
    }

    return successResponse(null);
  } catch (err) {
    log.error(`[otp] verifyAndLinkMFSAccount failed for ${type}`, err);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred during verification.');
  }
}

