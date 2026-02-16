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

export async function adminWipeTestData() {
  try {
    await requireAdmin();

    // Transaction to ensure all or nothing
    await prisma.$transaction([
      prisma.bid.deleteMany({}),
      // prisma.notification.deleteMany({}), // Model does not exist yet
      prisma.watchlist.deleteMany({}),
      prisma.auctionReport.deleteMany({}),
      prisma.auction.deleteMany({}), // Deletes ALL auctions
    ]);

    revalidatePath('/');
    return { success: true, message: 'All auction data wiped successfully.' };
  } catch (error: any) {
    console.error('Wipe Error:', error);
    return { success: false, error: 'Failed to wipe data: ' + error.message };
  }
}
