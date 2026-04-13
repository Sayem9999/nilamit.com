'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

/**
 * Update current user's profile
 */
export async function updateProfile(data: { name?: string; image?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.image && { image: data.image }),
    },
  });

  return { success: true, user };
}

/**
 * Get public profile for any user
 */
export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      reputationScore: true,
      isPhoneVerified: true,
      createdAt: true,
      _count: {
        select: {
          auctionsAsSeller: true,
          bids: true,
        },
      },
    },
  });

  return user;
}

/**
 * Link an MFS account (bKash/Nagad) for Escrow payments
 */
export async function linkMFSAccount(type: 'bkash' | 'nagad', number: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  // Basic Bangladeshi phone validation (11 digits, starts with 01)
  const phoneRegex = /^01[3-9]\d{8}$/;
  if (!phoneRegex.test(number)) {
    return { success: false, error: 'Invalid Bangladeshi mobile number.' };
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(type === 'bkash' && { bkashNumber: number }),
        ...(type === 'nagad' && { nagadNumber: number }),
      },
    });

    return { success: true, user };
  } catch (error) {
    console.error(`[Action] Failed to link ${type}:`, error);
    return { success: false, error: `Failed to link ${type}. This number might already be linked to another account.` };
  }
}
