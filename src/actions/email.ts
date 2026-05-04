'use server';

import { Resend } from 'resend';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';
import { apiLimiter } from '@/lib/ratelimit';
import { headers } from 'next/headers';
import crypto from 'crypto';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    if (!env.RESEND_API_KEY) {
      log.error('[email] RESEND_API_KEY is missing');
      throw new Error('Email service is not configured');
    }
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Sends a verification email to the current user
 */
export async function sendEmailVerification() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated or missing email.');
  }

  const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await apiLimiter.limit(`email_verify_${session.user.id}_${ip}`);
  if (!success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Please wait.');

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token using SHA256 (consistent with FirestoreAdapter)
    const id = crypto.createHash('sha256').update(`${session.user.email}:${token}`).digest('hex');
    await db.collection('verificationTokens').doc(id).set({
      identifier: session.user.email,
      token: token,
      expires: expires,
    });

    const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(session.user.email)}`;

    await getResend().emails.send({
      from: 'Nilamit <onboarding@resend.dev>', // Should be a verified domain in production
      to: session.user.email,
      subject: 'Verify your email for Nilamit',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h1 style="color: #4F46E5;">Verify Your Email</h1>
          <p>Thank you for joining Nilamit, Bangladesh's trusted auction marketplace.</p>
          <p>Please click the button below to verify your email address:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4F46E5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Verify Email</a>
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">Link expires in 24 hours.</p>
        </div>
      `,
    });

    return successResponse(null);
  } catch (e) {
    log.error('[email] sendEmailVerification failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to send verification email.');
  }
}

/**
 * Verifies the email token and updates user status
 */
export async function verifyEmailToken(token: string, email: string) {
  try {
    const id = crypto.createHash('sha256').update(`${email}:${token}`).digest('hex');
    const snap = await db.collection('verificationTokens').doc(id).get();

    if (!snap.exists) {
      return errorResponse(ErrorType.VALIDATION, 'Invalid or expired token.');
    }

    const data = snap.data();
    if (!data) return errorResponse(ErrorType.INTERNAL, 'Error reading token data');
    
    const { toDate: fsToDate } = await import('@/lib/db');
    if (new Date() > fsToDate(data.expires)) {
      await snap.ref.delete();
      return errorResponse(ErrorType.VALIDATION, 'Verification link has expired.');
    }

    // Find user by email
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) {
      return errorResponse(ErrorType.NOT_FOUND, 'User not found.');
    }

    const userId = userSnap.docs[0].id;

    // Mark as verified
    await db.collection('users').doc(userId).update({
      emailVerified: new Date(),
      updatedAt: new Date(),
    });

    // Cleanup token
    await snap.ref.delete();

    return successResponse(null);
  } catch (e) {
    log.error('[email] verifyEmailToken failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to verify email.');
  }
}
