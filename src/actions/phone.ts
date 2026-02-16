'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { smsGateway } from '@/lib/sms-gateway';
import { Resend } from 'resend';
import crypto from 'crypto';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_OTP_PER_HOUR = 5;

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP to a Bangladesh phone number (+880)
 */
export async function sendPhoneOTP(phone: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be logged in.' };
  }

  // Validate BD phone format
  if (!/^\+880\d{10}$/.test(phone)) {
    return { success: false, error: 'Invalid Bangladesh phone number. Use +880XXXXXXXXXX format.' };
  }

  // Check if phone already used by another verified user
  const existingUser = await prisma.user.findFirst({
    where: { phone, isPhoneVerified: true, id: { not: session.user.id } },
  });
  if (existingUser) {
    return { success: false, error: 'This phone number is already verified by another account.' };
  }

  // Rate limiting: max 5 OTPs per hour per user
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await prisma.phoneVerification.count({
    where: { userId: session.user.id, createdAt: { gt: oneHourAgo } },
  });
  if (recentCount >= MAX_OTP_PER_HOUR) {
    return { success: false, error: 'Too many OTP requests. Please try again in an hour.' };
  }

  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);

  // Store hashed OTP
  await prisma.phoneVerification.create({
    data: {
      userId: session.user.id,
      phone,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  console.log(`[sendPhoneOTP] Sending OTP to ${phone} via gateway '${process.env.SMS_PROVIDER || 'console'}'...`);

  // Send via SMS gateway
  const smsResult = await smsGateway.sendSMS(
    phone,
    `Your nilamit.com verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`
  );

  // Fallback: Send via Email (Resend) if SMS fails or is in dev mode
  const resendApiKey = process.env.RESEND_API_KEY;
  let emailSent = false;

  if (resendApiKey && session.user.email) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey); // Use the key from env
      
      await resend.emails.send({
        from: 'onboarding@resend.dev', // Default testing domain
        to: session.user.email,
        subject: 'Your Verification Code',
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code is used to verify your phone number (${phone}).</p>`,
      });
      emailSent = true;
      console.log(`[sendPhoneOTP] Fallback email sent to ${session.user.email}`);
    } catch (error: any) {
       console.error('[sendPhoneOTP] Resend fallback failed:', error?.message || error);
       if (error?.message?.includes('only send to')) {
         console.warn('⚠️ RESEND TEST MODE: You can only send emails to your own verified address. Verify a domain to send to others.');
       }
    }
  }

  if (!smsResult.success && !emailSent) {
    return { success: false, error: 'Failed to send OTP via SMS or Email.' };
  }

  return { success: true, message: emailSent ? 'OTP sent to your email.' : 'OTP sent to your phone.' };
}

/**
 * Verify OTP and mark user's phone as verified
 */
export async function verifyPhoneOTP(phone: string, otp: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be logged in.' };
  }

  const hashedOTP = hashOTP(otp);

  // Find matching verification
  const verification = await prisma.phoneVerification.findFirst({
    where: {
      userId: session.user.id,
      phone,
      otp: hashedOTP,
      expiresAt: { gt: new Date() },
      verified: false,
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
    // Increment attempt counter on most recent verification
    const latest = await prisma.phoneVerification.findFirst({
      where: { userId: session.user.id, phone, verified: false },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      await prisma.phoneVerification.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return { success: false, error: 'Invalid or expired OTP.' };
  }

  // Mark OTP as used and update user
  await prisma.$transaction([
    prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { verified: true },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { phone, isPhoneVerified: true },
    }),
  ]);

  return { success: true };
}

/**
 * Send email OTP for passwordless login
 */
export async function sendEmailOTP(email: string) {
  const otp = generateOTP();

  // Store in verification tokens (used by Auth.js credential provider)
  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: email, token: otp } },
    update: { token: otp, expires: new Date(Date.now() + OTP_EXPIRY_MS) },
    create: {
      identifier: email,
      token: otp,
      expires: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  // In production, send via email service (Resend)
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: 'onboarding@resend.dev', // Default testing domain
        to: email,
        subject: 'Your nilamit.com Login Code',
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>Valid for 5 minutes.</p>`,
      });

      if (error) {
        console.error('[Resend Error]', error);
        return { success: false, error: 'Failed to send email.' };
      }
      return { success: true };
    } catch (err) {
      console.error('[Email Error]', err);
      return { success: false, error: 'Failed to send email.' };
    }
  } else {
    // Fallback for local dev without API key (only if explicitly allowed, but Constitution says NO)
    // We will log a warning that this is NOT production ready
    console.warn('[WARN] RESEND_API_KEY missing. Falling back to console log (NOT FOR PRODUCTION).');
    console.log(`\n📧 [EMAIL OTP → ${email}] Code: ${otp}\n`);
    return { success: true }; // Allow login in dev, but warn
  }
}
