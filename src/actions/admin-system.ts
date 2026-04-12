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
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Wipe Error:', err);
    return { success: false, error: 'Failed to wipe data: ' + err.message };
  }
}

export async function exportTransactionsCSV() {
  try {
    await requireAdmin();

    // Fetch all SOLD auctions with winner data
    const auctions = await prisma.auction.findMany({
      where: {
        status: 'SOLD',
      },
      include: {
        winner: { select: { name: true, phone: true } },
        seller: { select: { name: true, phone: true } },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Create CSV Header
    let csv = 'Auction ID,Title,Final Price,Winner Name,Winner Phone,Commission (৳),Date\n';

    // Build Rows
    for (const auction of auctions) {
      const commission = auction.currentPrice * 0.1; // 10% standard commission
      
      const row = [
        auction.id,
        `"${auction.title.replace(/"/g, '""')}"`,
        auction.currentPrice,
        auction.winner?.name || 'Unknown',
        auction.winner?.phone || 'N/A',
        commission.toFixed(2),
        auction.updatedAt.toISOString().split('T')[0],
      ];
      
      csv += row.join(',') + '\n';
    }

    return { success: true, data: csv };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('CSV Export Error:', err);
    return { success: false, error: 'Failed to generate CSV: ' + err.message };
  }
}
