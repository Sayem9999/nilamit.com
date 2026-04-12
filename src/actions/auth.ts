'use server';

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

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
