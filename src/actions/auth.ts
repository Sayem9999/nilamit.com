'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyStandaloneOTP } from './phone';
import { normalizePhone } from '@/lib/utils';

export async function registerUser(data: { firstName: string; lastName: string; email: string; password: string }) {
  const { firstName, lastName, email, password } = data;
  if (!email || !password || !firstName || !lastName) {
    return { success: false, error: 'Missing required fields' };
  }

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
    console.error('[auth] registerUser:', e);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function signupWithPhone(data: { name: string; phone: string; otp: string; password: string; email?: string }) {
  const { name, phone, otp, password, email } = data;
  const normalizedPhone = normalizePhone(phone);

  const otpVerify = await verifyStandaloneOTP(normalizedPhone, otp);
  if (!otpVerify.success) return otpVerify;

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
    console.error('[auth] signupWithPhone:', e);
    return { success: false, error: 'Failed to create account.' };
  }
}

export async function resetPasswordWithOTP(data: { phone?: string; email?: string; otp: string; password: string }) {
  const { phone, email, otp, password } = data;
  if (!phone && !email) return { success: false, error: 'Identifier required.' };

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
    console.error('[auth] resetPasswordWithOTP:', e);
    return { success: false, error: 'Failed to reset password.' };
  }
}
