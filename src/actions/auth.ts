'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyStandaloneOTP } from './phone';
import { normalizePhone } from '@/lib/utils';
import { headers } from 'next/headers';
import { loginLimiter } from '@/lib/ratelimit';
import * as Sentry from '@sentry/nextjs';
import { registerSchema, phoneSignupSchema, passwordResetSchema, formatZodError } from '@/lib/schemas';
import { log } from '@/lib/logger';

export async function registerUser(data: unknown) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const { firstName, lastName, email, password } = parsed.data;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await loginLimiter.limit(`register_${ip}`);
  if (!rateLimitSuccess) return { success: false, error: 'Too many requests. Try again later.' };

  try {
    const existing = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty) return { success: false, error: 'Email already registered' };

    const hashedPassword = await bcrypt.hash(password, 10);
    const ref  = db.collection('users').doc();
    const now  = new Date();
    await ref.set({
      id: ref.id, name: `${firstName} ${lastName}`.trim(), email,
      password: hashedPassword, emailVerified: null, image: null, phone: null,
      isPhoneVerified: false, isVerifiedSeller: false, reputationScore: 0,
      winningStreak: 0, userLevel: 1, createdAt: now, updatedAt: now,
    });

    return { success: true };
  } catch (e) {
    log.error('[auth] registerUser', e);
    Sentry.captureException(e, { tags: { action: 'registerUser' } });
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function signupWithPhone(data: unknown) {
  const parsed = phoneSignupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const { name, phone, otp, password, email } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  const otpVerify = await verifyStandaloneOTP(normalizedPhone, otp);
  if (!otpVerify.success) return otpVerify;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await loginLimiter.limit(`signup_${ip}`);
  if (!rateLimitSuccess) return { success: false, error: 'Too many requests. Try again later.' };

  const phoneExists = await db.collection('users').where('phone', '==', normalizedPhone).limit(1).get();
  if (!phoneExists.empty) return { success: false, error: 'Phone number already registered.' };

  if (email) {
    const emailExists = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!emailExists.empty) return { success: false, error: 'Email already registered.' };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const ref  = db.collection('users').doc();
    const now  = new Date();
    await ref.set({
      id: ref.id, name, phone: normalizedPhone, password: hashedPassword,
      email: email ?? `user-${Date.now()}@nilamit.placeholder`,
      emailVerified: null, image: null,
      isPhoneVerified: true, isVerifiedSeller: false, reputationScore: 0,
      winningStreak: 0, userLevel: 1, createdAt: now, updatedAt: now,
    });
    return { success: true };
  } catch (e) {
    log.error('[auth] signupWithPhone', e);
    Sentry.captureException(e, { tags: { action: 'signupWithPhone' } });
    return { success: false, error: 'Failed to create account.' };
  }
}

export async function resetPasswordWithOTP(data: unknown) {
  const parsed = passwordResetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const { phone, email, otp, password } = parsed.data;

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await loginLimiter.limit(`reset_${ip}`);
  if (!rateLimitSuccess) return { success: false, error: 'Too many requests. Try again later.' };

  try {
    if (phone) {
      const otpVerify = await verifyStandaloneOTP(phone, otp);
      if (!otpVerify.success) return otpVerify;
    } else if (email) {
      const tokenSnap = await db.collection('verificationTokens')
        .where('identifier', '==', email)
        .where('token', '==', otp)
        .limit(1).get();
      if (tokenSnap.empty) return { success: false, error: 'Invalid or expired OTP.' };
      const tokenDoc = tokenSnap.docs[0];
      const expires  = tokenDoc.data().expires?.toDate?.() ?? new Date(tokenDoc.data().expires);
      if (expires < new Date()) return { success: false, error: 'OTP expired.' };
      await tokenDoc.ref.delete();
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const field          = phone ? 'phone' : 'email';
    const value          = phone ?? email!;

    const snap = await db.collection('users').where(field, '==', value).limit(1).get();
    if (snap.empty) return { success: false, error: 'User not found.' };
    await snap.docs[0].ref.update({ password: hashedPassword, updatedAt: new Date() });

    return { success: true };
  } catch (e) {
    log.error('[auth] resetPasswordWithOTP', e);
    Sentry.captureException(e, { tags: { action: 'resetPasswordWithOTP' } });
    return { success: false, error: 'Failed to reset password.' };
  }
}
