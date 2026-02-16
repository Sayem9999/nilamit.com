'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus, OrderStatus } from '@prisma/client';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

/** Dashboard stats for admin */
export async function getAdminStats() {
  await requireAdmin();

  const [totalUsers, verifiedUsers, totalAuctions, activeAuctions, totalBids, revenueStats, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPhoneVerified: true } }),
    prisma.auction.count(),
    prisma.auction.count({ where: { status: AuctionStatus.ACTIVE } }),
    prisma.bid.count(),
    prisma.auction.aggregate({
      where: { status: AuctionStatus.SOLD },
      _sum: { commissionEarned: true }
    }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, email: true, isPhoneVerified: true, isVerifiedSeller: true, reputationScore: true, createdAt: true } }),
  ]);

  return { 
    totalUsers, 
    verifiedUsers, 
    totalAuctions, 
    activeAuctions, 
    totalBids, 
    totalRevenue: (revenueStats._sum.commissionEarned as number | null) || 0,
    recentUsers 
  };
}

/** List all users with pagination */
export async function getAdminUsers(page = 1, limit = 20, search?: string) {
  await requireAdmin();

  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search } },
    ],
  } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, isPhoneVerified: true, isVerifiedSeller: true, reputationScore: true, createdAt: true, _count: { select: { bids: true, auctionsAsSeller: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, pages: Math.ceil(total / limit) };
}

/** List all auctions for admin */
export async function getAdminAuctions(page = 1, limit = 20, status?: string) {
  await requireAdmin();

  const where = status ? { status: status as AuctionStatus } : {};

  const [auctions, total] = await Promise.all([
    prisma.auction.findMany({
      where,
      include: { seller: { select: { name: true, email: true } }, _count: { select: { bids: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auction.count({ where }),
  ]);

  return { auctions, total, pages: Math.ceil(total / limit) };
}

/** Admin: update user reputation */
export async function adminUpdateUser(userId: string, data: { reputationScore?: number; isPhoneVerified?: boolean }) {
  await requireAdmin();
  return prisma.user.update({ where: { id: userId }, data });
}

/** Admin: toggle verified seller status */
export async function adminToggleVerification(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isVerifiedSeller: true } });
  if (!user) throw new Error('User not found');
  
  return prisma.user.update({
    where: { id: userId },
    data: { isVerifiedSeller: !user.isVerifiedSeller }
  });
}

/** Admin: update delivery status */
export async function adminUpdateDelivery(auctionId: string, status: OrderStatus) {
  await requireAdmin();
  return prisma.auction.update({ where: { id: auctionId }, data: { deliveryStatus: status } });
}

/** Admin: force-cancel an auction */
export async function adminCancelAuction(auctionId: string) {
  await requireAdmin();
  return prisma.auction.update({ where: { id: auctionId }, data: { status: AuctionStatus.CANCELLED } });
}
