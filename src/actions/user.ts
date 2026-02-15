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
