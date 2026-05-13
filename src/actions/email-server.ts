'use server';

import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';
import crypto from 'crypto';
import { sendEmail } from '@/lib/firebase-email';

/**
 * Sends a verification email to a specific email address (Server-side trigger)
 * This is used during registration before the user has a session.
 */
export async function sendEmailVerificationByEmail(email: string) {
  try {
    const emailNormalized = email.trim().toLowerCase();
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token using SHA256 (consistent with FirestoreAdapter and email.ts)
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
      to: email,
      subject: 'Verify your email for Nilamit',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px;">
          <h1 style="color: #4F46E5; margin-bottom: 24px;">Welcome to Nilamit!</h1>
          <p>Thank you for signing up. To start bidding and selling on Bangladesh's most trusted marketplace, please verify your email address.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background: #4F46E5; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email Address</a>
          </div>
          <p>This link will expire in 24 hours.</p>
          <p style="font-size: 14px; color: #666;">If you didn't create an account with Nilamit, you can safely ignore this message.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">© 2026 Nilamit. All rights reserved.</p>
        </div>
      `,
    });

    return { success: true };
  } catch (e) {
    log.error('[email-server] sendEmailVerificationByEmail failed', e);
    throw e;
  }
}
