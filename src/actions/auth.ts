'use server';

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyStandaloneOTP } from './phone';

export async function registerUser(data: { firstName: string; lastName: string; email: string; password: string }) {
  try {
    const { firstName, lastName, email, password } = data;

    if (!email || !password || !firstName || !lastName) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`.trim(),
        email,
        password: hashedPassword,
        isPhoneVerified: false, 
      },
    });

    return { success: true };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    console.error('Registration Error:', e);
    return { success: false, error: errorMessage };
  }
}

/**
 * Signup with Phone
 */
export async function signupWithPhone(data: { 
  name: string; 
  phone: string; 
  otp: string; 
  password: string;
  email?: string;
}) {
  try {
    const { name, phone, otp, password, email } = data;

    // 1. Verify OTP
    const otpVerify = await verifyStandaloneOTP(phone, otp);
    if (!otpVerify.success) return otpVerify;

    // 2. Check phone/email exists
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) return { success: false, error: 'Phone number already registered.' };

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) return { success: false, error: 'Email already registered.' };
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create User
    await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        email: email || `user-${Date.now()}@nilamit.placeholder`, // Placeholder if no email
        isPhoneVerified: true,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[signupWithPhone]', error);
    return { success: false, error: 'Failed to create account.' };
  }
}

/**
 * Reset password with OTP (Phone or Email)
 */
export async function resetPasswordWithOTP(data: {
  phone?: string;
  email?: string;
  otp: string;
  password: string;
}) {
  try {
    const { phone, email, otp, password } = data;
    const identifier = phone || email;
    if (!identifier) return { success: false, error: 'Identifier required.' };

    // 1. Verify OTP
    // For Phone
    if (phone) {
      const otpVerify = await verifyStandaloneOTP(phone, otp);
      if (!otpVerify.success) return otpVerify;
    } 
    // For Email
    else if (email) {
      const token = await prisma.verificationToken.findFirst({
        where: { identifier: email, token: otp, expires: { gt: new Date() } }
      });
      if (!token) return { success: false, error: 'Invalid or expired OTP.' };
      
      // Delete token after use
      await prisma.verificationToken.delete({ 
        where: { identifier_token: { identifier: email, token: otp } } 
      });
    }

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Update User
    await prisma.user.update({
      where: phone ? { phone } : { email },
      data: { password: hashedPassword },
    });

    return { success: true };
  } catch (error) {
    console.error('[resetPasswordWithOTP]', error);
    return { success: false, error: 'Failed to reset password.' };
  }
}
