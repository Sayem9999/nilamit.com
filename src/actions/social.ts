'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Gets user's reputation and streaks
 */
export async function getUserReputation(userId?: string) {
  const targetId = userId;
  if (!targetId) {
    const session = await auth();
    if (!session?.user?.id) return null;
    userId = session.user.id;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      winningStreak: true,
      userLevel: true,
      reputationScore: true,
      name: true,
      image: true
    }
  });
}

/**
 * Gets all active conversations for the user
 */
export async function getUserConversations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.conversation.findMany({
    where: {
      OR: [
        { buyerId: session.user.id },
        { sellerId: session.user.id }
      ]
    },
    include: {
      auction: {
        select: {
          title: true,
          images: true,
          seller: { select: { name: true, image: true } },
          winner: { select: { name: true, image: true } }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { lastMessageAt: 'desc' }
  });
}
