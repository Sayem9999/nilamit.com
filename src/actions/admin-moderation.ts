'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { ReportStatus } from '@prisma/client';

/**
 * Check if the current user is an admin
 */
async function checkAdmin() {
  const session = await auth();
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  
  if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required');
  }
  return session.user;
}

/**
 * Get all reports with optional status filter
 */
export async function getAdminReports(status: ReportStatus = 'PENDING') {
  await checkAdmin();

  try {
    const reports = await prisma.auctionReport.findMany({
      where: { status },
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            status: true,
            images: true,
            seller: { select: { name: true, email: true } }
          }
        },
        reporter: {
          select: { name: true, email: true, image: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, reports };
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    return { success: false, error: 'Failed to fetch reports' };
  }
}

/**
 * Resolve a report (Dismiss or Mark as Resolved)
 */
export async function resolveReport(reportId: string, newStatus: ReportStatus) {
  await checkAdmin();

  try {
    await prisma.auctionReport.update({
      where: { id: reportId },
      data: { status: newStatus },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Failed to resolve report:', error);
    return { success: false, error: 'Failed to update report status' };
  }
}

/**
 * Suspend an auction (Cancel it) due to moderation
 */
export async function suspendAuction(auctionId: string, reportId?: string) {
  await checkAdmin();

  try {
    // Transaction: Cancel auction AND resolve specific report if provided
    await prisma.$transaction(async (tx) => {
      // 1. Cancel the auction
      await tx.auction.update({
        where: { id: auctionId },
        data: { status: 'CANCELLED' as any }, // Using CANCELLED as equivalent to SUSPENDED for now
      });

      // 2. If a specific report triggered this, mark it as RESOLVED
      if (reportId) {
        await tx.auctionReport.update({
          where: { id: reportId },
          data: { status: 'RESOLVED' },
        });
      }
    });

    revalidatePath('/admin');
    revalidatePath(`/auctions/${auctionId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to suspend auction:', error);
    return { success: false, error: 'Failed to suspend auction' };
  }
}
