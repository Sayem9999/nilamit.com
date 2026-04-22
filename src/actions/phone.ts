'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { normalizePhone } from '@/lib/utils';
import { smsGateway } from '@/lib/sms-gateway';

import crypto from 'crypto';

const OTP_EXPIRY_MS         = 5 * 60 * 1000;
const MAX_ATTEMPTS          = 5;
const RATE_LIMIT_WINDOW_MS  = 60 * 60 * 1000;
const MAX_OTP_PER_HOUR      = 5;

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendPhoneOTP(phone: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'You must be logged in.' };

  const normalizedPhone = normalizePhone(phone);
  if (!/^\+8801\d{9}$/.test(normalizedPhone)) {
    return { success: false, error: 'Invalid Bangladesh phone number.' };
  }

  // Check already verified by another user
  const existingSnap = await db.collection('users')
    .where('phone', '==', normalizedPhone)
    .where('isPhoneVerified', '==', true)
    .limit(1).get();
  if (!existingSnap.empty && existingSnap.docs[0].id !== session.user.id) {
    return { success: false, error: 'This phone number is already verified by another account.' };
  }

  return await internalSendOTP(normalizedPhone, session.user.id, session.user.email ?? undefined);
}

export async function requestStandaloneOTP(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!/^\+8801\d{9}$/.test(normalizedPhone)) {
    return { success: false, error: 'Invalid Bangladesh phone number.' };
  }
  return await internalSendOTP(normalizedPhone);
}

async function internalSendOTP(phone: string, userId?: string, email?: string) {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const rateSnap   = await db.collection('phoneVerifications')
    .where('phone', '==', phone)
    .where('createdAt', '>', oneHourAgo)
    .get();

  if (rateSnap.size >= MAX_OTP_PER_HOUR) {
    return { success: false, error: 'Too many OTP requests. Please try again in an hour.' };
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

  const smsResult = await smsGateway.sendSMS(
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
    } catch (e) { console.error('[phone] Firebase email fallback failed:', e); }
  }

  if (!smsResult.success && !emailSent) {
    return { success: false, error: 'Failed to send OTP. Please try again later.' };
  }
  return { success: true, message: 'OTP sent successfully.' };
}

export async function verifyPhoneOTP(phone: string, otp: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'You must be logged in.' };

  const result = await internalVerifyOTP(phone, otp, session.user.id);
  if (!result.success) return result;

  await db.collection('users').doc(session.user.id).update({
    phone, isPhoneVerified: true, updatedAt: new Date(),
  });
  return { success: true };
}

export async function verifyStandaloneOTP(phone: string, otp: string) {
  return await internalVerifyOTP(normalizePhone(phone), otp);
}

async function internalVerifyOTP(phone: string, otp: string, userId?: string) {
  const hashedOTP = hashOTP(otp);
  const now       = new Date();

  let query: FirebaseFirestore.Query = db.collection('phoneVerifications')
    .where('phone', '==', phone)
    .where('otp', '==', hashedOTP)
    .where('expiresAt', '>', now)
    .where('verified', '==', false);
  if (userId) query = query.where('userId', '==', userId);
  query = query.orderBy('createdAt', 'desc').limit(1);

  const snap = await query.get();

  if (snap.empty) {
    // Increment attempt on latest
    const latestSnap = await db.collection('phoneVerifications')
      .where('phone', '==', phone)
      .where('verified', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get();
    if (!latestSnap.empty) {
      const latest = latestSnap.docs[0];
      if ((latest.data().attempts ?? 0) < MAX_ATTEMPTS) {
        await latest.ref.update({ attempts: (latest.data().attempts ?? 0) + 1 });
      }
    }
    return { success: false, error: 'Invalid or expired OTP.' };
  }

  await snap.docs[0].ref.update({ verified: true });
  return { success: true };
}

export async function sendEmailOTP(email: string) {
  const otp        = generateOTP();
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const rateSnap = await db.collection('verificationTokens')
    .where('identifier', '==', email)
    .where('expires', '>', oneHourAgo)
    .get();
  if (rateSnap.size >= MAX_OTP_PER_HOUR) {
    return { success: false, error: 'Too many OTP requests. Try again in an hour.' };
  }

  const tokenId = `${email}__${otp}`;
  await db.collection('verificationTokens').doc(tokenId).set({
    identifier: email, token: otp, expires: new Date(Date.now() + OTP_EXPIRY_MS),
  });

  try {
    const { sendEmail } = await import('@/lib/firebase-email');
    await sendEmail({
      to: email,
      subject: 'Your nilamit.com Login Code',
      html: `<p>Your code: <strong>${otp}</strong> — valid 5 minutes.</p>`,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to send email.' };
  }
}
