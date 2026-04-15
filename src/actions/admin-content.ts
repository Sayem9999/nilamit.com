'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
}

function isDatabaseUnavailable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P1001' || error.code === 'P2021' || error.code === 'P2022')
  );
}

export async function getSystemConfig() {
  const fallbackConfig = {
    id: 'default',
    heroTitle: null,
    heroSubtitle: null,
    heroImage: null,
    announcement: null,
    showAnnouncement: false,
    treasuryBkash: "017XXXXXXXX",
    treasuryNagad: "018XXXXXXXX",
    updatedAt: new Date(),
  };

  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
    return config ?? fallbackConfig;
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.warn('[admin-content] DB unavailable while loading system config, using safety fallback.');
      return fallbackConfig;
    }

    throw error;
  }
}

export async function updateSystemConfig(data: {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string | null;
  announcement?: string | null;
  showAnnouncement?: boolean;
  treasuryBkash?: string | null;
  treasuryNagad?: string | null;
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
  try {
    return await prisma.auction.findMany({
      where: { isFeatured: true },
      select: { id: true, title: true, currentPrice: true, images: true, status: true },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.warn('[admin-content] DB unavailable while loading featured auctions, returning empty list.');
      return [];
    }

    throw error;
  }
}
