'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * reportAuction — Allow users to flag problematic auctions
 */
export async function reportAuction(auctionId: string, reason: string, description?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be logged in to report an auction.' };
  }

  try {
    const report = await prisma.auctionReport.create({
      data: {
        auctionId,
        reporterId: session.user.id,
        reason,
        description,
      },
    });

    return { success: true, report };
  } catch (error) {
    return { success: false, error: 'Failed to submit report. You may have already reported this auction.' };
  }
}

/**
 * getReports — For Admin panel
 */
export async function getReports(status: 'PENDING' | 'RESOLVED' = 'PENDING') {
  const session = await auth();
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  
  if (!session?.user?.id || !adminEmails.includes(session.user.email || '')) {
    throw new Error('Unauthorized');
  }

  return prisma.auctionReport.findMany({
    where: { status: status as any },
    include: {
      auction: { select: { title: true, id: true } },
      reporter: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
