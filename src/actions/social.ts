'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Creates a new private auction circle
 */
export async function createAuctionCircle(name: string, description?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  // Generate a unique 6-character invite code
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
  
    const circle = await prisma.auctionCircle.create({
      data: {
        name,
        description,
        inviteCode,
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id
          }
        }
      }
    });

    revalidatePath('/social');
    return { success: true, circle };
  } catch (error) {
    console.error("Error creating circle:", error);
    return { success: false, error: "Failed to create circle" };
  }
}

/**
 * Joins an existing circle via invite code
 */
export async function joinAuctionCircle(inviteCode: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  try {
  
    const circle = await prisma.auctionCircle.findUnique({
      where: { inviteCode }
    });

    if (!circle) return { success: false, error: "Invalid invite code" };

    await prisma.circleMember.create({
      data: {
        userId: session.user.id,
        circleId: circle.id
      }
    });

    revalidatePath('/social');
    return { success: true, circle };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: "You are already a member of this circle" };
    }
    return { success: false, error: "Failed to join circle" };
  }
}

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
 * Gets circles user belongs to
 */
export async function getUserCircles() {
  const session = await auth();
  if (!session?.user?.id) return [];
  

  return prisma.auctionCircle.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } }
      ]
    },
    include: {
      _count: {
        select: { members: true, auctions: true }
      }
    }
  });
}
