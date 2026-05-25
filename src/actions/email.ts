'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, type ServiceResponse } from '@/lib/errors';
import { apiLimiter } from '@/lib/ratelimit';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { sendEmail } from '@/lib/firebase-email';

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
    const emailNormalized = session.user.email.trim().toLowerCase();

    // Store token using SHA256 (consistent with FirestoreAdapter)
    const id = crypto.createHash('sha256').update(`${emailNormalized}:${token}`).digest('hex');
    await db.collection('verificationTokens').doc(id).set({
      identifier: emailNormalized,
      token: token,
      expires: expires,
    });

    const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(emailNormalized)}`;

    // Log operational metadata without leaking the sensitive verification token
    const maskedUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=******&email=${encodeURIComponent(emailNormalized)}`;
    log.info(`[Email Dispatch] Verification link generated`, { to: emailNormalized, url: maskedUrl });

    await sendEmail({
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
    const emailNormalized = email.trim().toLowerCase();
    const id = crypto.createHash('sha256').update(`${emailNormalized}:${token}`).digest('hex');
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
    const userSnap = await db.collection('users').where('email', '==', emailNormalized).limit(1).get();
    if (userSnap.empty) {
      return errorResponse(ErrorType.NOT_FOUND, 'User not found.');
    }

    const userId = userSnap.docs[0].id;

    // Mark as verified and auto-upgrade to verified seller
    await db.collection('users').doc(userId).update({
      emailVerified: new Date(),
      isVerifiedSeller: true,
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

/**
 * Marks the email as verified in Firestore if it was successfully verified in Firebase Auth.
 * This is a highly secure endpoint that double-checks client-side assertions on the server.
 */
export async function markEmailVerifiedNatively(): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  }

  try {
    const { adminAuth } = await import('@/lib/firebase-admin');
    const userRecord = await adminAuth.instance.getUser(session.user.id);
    
    if (!userRecord.emailVerified) {
      return errorResponse(ErrorType.VALIDATION, 'Email not verified in Firebase.');
    }

    await db.collection('users').doc(session.user.id).update({
      emailVerified: new Date(),
      isVerifiedSeller: true,
      updatedAt: new Date(),
    });

    log.info(`[Email] Email verified natively via Firebase for user ${session.user.id}`);
    return successResponse(null);
  } catch (e) {
    log.error('[email] markEmailVerifiedNatively failed', e);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}
