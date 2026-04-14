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
/**
 * Gets data for the Trust Graph (StarMap)
 * Returns nodes (Users) and links (Mutual Interactions)
 */
export async function getTrustGraphData() {
  const session = await auth();
  
  // 1. Fetch relevant users (Verified ones + Recent active ones)
  const users = await prisma.user.findMany({
    take: 40,
    orderBy: { reputationScore: 'desc' },
    select: {
      id: true,
      name: true,
      reputationScore: true,
      isVerifiedSeller: true,
      userLevel: true,
      image: true
    }
  });

  const nodes = users.map(u => ({
    id: u.id,
    label: u.name || `User-${u.id.substring(0, 4)}`,
    reputation: u.reputationScore,
    isVerified: u.isVerifiedSeller,
    level: u.userLevel,
    img: u.image
  }));

  // 2. Fetch relationships (Links)
  // Relationship: Shared Auctions (Bidding context)
  const links: Array<{ source: string, target: string, value: number, type: string }> = [];

  // Fetch recent auctions with multiple bids
  const recentAuctions = await prisma.auction.findMany({
    take: 20,
    where: { bids: { some: {} } },
    include: {
      bids: { select: { bidderId: true }, distinct: ['bidderId'] }
    }
  });

  const linkSet = new Set<string>();

  recentAuctions.forEach(auction => {
    const bidders = auction.bids.map(b => b.bidderId);
    
    // Link Seller to Winner (Strong Connection)
    if (auction.winnerId && auction.sellerId) {
      const key = [auction.sellerId, auction.winnerId].sort().join('-');
      if (!linkSet.has(key)) {
        links.push({ source: auction.sellerId, target: auction.winnerId, value: 10, type: 'SALE' });
        linkSet.add(key);
      }
    }

    // Link Co-bidders (Discovery Connection)
    for (let i = 0; i < bidders.length; i++) {
      for (let j = i + 1; j < bidders.length; j++) {
        const key = [bidders[i], bidders[j]].sort().join('-');
        if (!linkSet.has(key)) {
          links.push({ source: bidders[i], target: bidders[j], value: 2, type: 'INTEREST' });
          linkSet.add(key);
        }
      }
    }
  });

  return { nodes, links };
}
