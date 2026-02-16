'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
}

export async function getSystemConfig() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    // Return defaults if not found
    return {
      heroTitle: "Buy & Sell in Real-time Auctions",
      heroSubtitle: "Bangladesh's most trusted C2C marketplace.",
      heroImage: null,
      announcement: null,
      showAnnouncement: false,
    };
  }
  return config;
}

export async function updateSystemConfig(data: {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  announcement?: string;
  showAnnouncement?: boolean;
}) {
  await requireAdmin();

  const config = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });

  revalidatePath('/'); // Refresh homepage
  return { success: true, config };
}

export async function toggleFeaturedAuction(auctionId: string) {
  await requireAdmin();

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw new Error('Auction not found');

  const updated = await prisma.auction.update({
    where: { id: auctionId },
    data: { isFeatured: !auction.isFeatured },
  });

  revalidatePath('/');
  return { success: true, isFeatured: updated.isFeatured };
}

export async function getFeaturedAuctions() {
  return prisma.auction.findMany({
    where: { isFeatured: true },
    select: { id: true, title: true, currentPrice: true, images: true, status: true },
  });
}
