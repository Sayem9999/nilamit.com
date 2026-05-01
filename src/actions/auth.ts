'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyStandaloneOTP } from './phone';
import { normalizePhone } from '@/lib/utils';
import { headers } from 'next/headers';
import { loginLimiter, emailOtpVerifyLimiter } from '@/lib/ratelimit';
import * as Sentry from '@sentry/nextjs';
import { registerSchema, phoneSignupSchema, passwordResetSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import crypto from 'crypto';

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function registerUser(data: unknown) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  const { name, email, password } = parsed.data;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await loginLimiter.limit(`register_${ip}`);
  if (!rateLimitSuccess) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Try again later.');

  try {
    const existing = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty) return errorResponse(ErrorType.CONFLICT, 'Email already registered');

    const hashedPassword = await bcrypt.hash(password, 10);
    const ref  = db.collection('users').doc();
    const now  = new Date();
    await ref.set({
      id: ref.id, name, email,
      password: hashedPassword, emailVerified: null, image: null, phone: null,
      isPhoneVerified: false, isVerifiedSeller: false, reputationScore: 0,
      winningStreak: 0, userLevel: 1, createdAt: now, updatedAt: now,
    });

    return successResponse(null);
  } catch (e) {
    log.error('[auth] registerUser', e);
    Sentry.captureException(e, { tags: { action: 'registerUser' } });
    return errorResponse(ErrorType.INTERNAL, 'Something went wrong. Please try again.');
  }
}

export async function signupWithPhone(data: unknown) {
  const parsed = phoneSignupSchema.safeParse(data);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  const { name, phone, otp, password, email } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  // Rate-limit BEFORE consuming the OTP — prevents OTP DOS and IP-rotation abuse
  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await loginLimiter.limit(`signup_${ip}`);
  if (!rateLimitSuccess) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Try again later.');

  const otpVerify = await verifyStandaloneOTP(normalizedPhone, otp);
  if (!otpVerify.success) return otpVerify;

  const phoneExists = await db.collection('users').where('phone', '==', normalizedPhone).limit(1).get();
  if (!phoneExists.empty) return errorResponse(ErrorType.CONFLICT, 'Phone number already registered.');

  if (email) {
    const emailExists = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!emailExists.empty) return errorResponse(ErrorType.CONFLICT, 'Email already registered.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const ref  = db.collection('users').doc();
    const now  = new Date();
    await ref.set({
      id: ref.id, name, phone: normalizedPhone, password: hashedPassword,
      email: email ?? null,
      emailVerified: null, image: null,
      isPhoneVerified: true, isVerifiedSeller: false, reputationScore: 0,
      winningStreak: 0, userLevel: 1, createdAt: now, updatedAt: now,
    });
    return successResponse(null);
  } catch (e) {
    log.error('[auth] signupWithPhone', e);
    Sentry.captureException(e, { tags: { action: 'signupWithPhone' } });
    return errorResponse(ErrorType.INTERNAL, 'Failed to create account.');
  }
}

export async function resetPasswordWithOTP(data: unknown) {
  const parsed = passwordResetSchema.safeParse(data);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  const { phone, email, otp, password } = parsed.data;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await loginLimiter.limit(`reset_${ip}`);
  if (!rateLimitSuccess) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Try again later.');

  try {
    if (phone) {
      const otpVerify = await verifyStandaloneOTP(phone, otp);
      if (!otpVerify.success) return otpVerify;
    } else if (email) {
      const normalizedEmail = email.trim().toLowerCase();

      // Per-address verify rate limit — mirrors phone OTP brute-force protection
      const verifyGate = await emailOtpVerifyLimiter.limit(`email_verify_${normalizedEmail}`);
      if (!verifyGate.success) {
        return errorResponse(ErrorType.RATE_LIMIT, 'Too many attempts. Please request a new code.');
      }

      // Query against the stored hash (sendEmailOTP now hashes before storing)
      const hashedOTP = hashOTP(otp);
      const tokenSnap = await db.collection('verificationTokens')
        .where('identifier', '==', normalizedEmail)
        .where('token', '==', hashedOTP)
        .limit(1).get();
      if (tokenSnap.empty) return errorResponse(ErrorType.VALIDATION, 'Invalid or expired OTP.');
      const tokenDoc = tokenSnap.docs[0];
      const expires  = tokenDoc.data().expires?.toDate?.() ?? new Date(tokenDoc.data().expires);
      if (expires < new Date()) return errorResponse(ErrorType.VALIDATION, 'OTP expired.');
      await tokenDoc.ref.delete();
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const field          = phone ? 'phone' : 'email';
    const value          = phone ?? email!;

    const snap = await db.collection('users').where(field, '==', value).limit(1).get();
    if (snap.empty) return errorResponse(ErrorType.NOT_FOUND, 'User not found.');
    await snap.docs[0].ref.update({ password: hashedPassword, updatedAt: new Date() });

    return successResponse(null);
  } catch (e) {
    log.error('[auth] resetPasswordWithOTP', e);
    Sentry.captureException(e, { tags: { action: 'resetPasswordWithOTP' } });
    return errorResponse(ErrorType.INTERNAL, 'Failed to reset password.');
  }
}
