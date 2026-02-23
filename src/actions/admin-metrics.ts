'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus } from '@prisma/client';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized');
  }
  return session;
}

export interface KeyMetrics {
  totalUsers: number;
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalBids: number;
  totalGMV: number;
  liquidityRate: number;       // % of listings that received ≥1 bid
  sellThroughRate: number;     // % of auctions that completed with a winner
  repeatSellerRate: number;    // % of sellers who listed >1 auction
  avgBidsPerAuction: number;
  avgTimeToFirstBidHours: number;
  avgAuctionValue: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  bidsLast7Days: number;
  bidsLast30Days: number;
  topCategories: { category: string; count: number }[];
  dailyBids: { date: string; count: number }[];
  dailySignups: { date: string; count: number }[];
}

export async function getKeyMetrics(): Promise<KeyMetrics> {
  await requireAdmin();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalAuctions,
    activeAuctions,
    completedAuctions,
    totalBids,
    gmvResult,
    auctionsWithBids,
    allSellers,
    newUsers7d,
    newUsers30d,
    bids7d,
    bids30d,
    recentBids,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.auction.count(),
    prisma.auction.count({ where: { status: AuctionStatus.ACTIVE } }),
    prisma.auction.count({ where: { status: AuctionStatus.SOLD } }),
    prisma.bid.count(),
    prisma.auction.aggregate({
      where: { status: AuctionStatus.SOLD },
      _sum: { currentPrice: true },
    }),
    prisma.auction.count({
      where: { bids: { some: {} } },
    }),
    prisma.auction.groupBy({
      by: ['sellerId'],
      _count: true,
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.bid.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.bid.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.bid.findMany({
      select: { createdAt: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Category distribution
  const categoryData = await prisma.auction.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
    take: 8,
  });

  // Avg bids per auction
  const avgBidsPerAuction = totalAuctions > 0 ? Math.round((totalBids / totalAuctions) * 10) / 10 : 0;

  // Liquidity rate
  const liquidityRate = totalAuctions > 0 ? Math.round((auctionsWithBids / totalAuctions) * 1000) / 10 : 0;

  // Sell-through rate
  const sellThroughRate = totalAuctions > 0 ? Math.round((completedAuctions / totalAuctions) * 1000) / 10 : 0;

  // Repeat seller rate
  const repeatSellers = allSellers.filter(s => s._count > 1).length;
  const repeatSellerRate = allSellers.length > 0 ? Math.round((repeatSellers / allSellers.length) * 1000) / 10 : 0;

  // GMV
  const totalGMV = (gmvResult._sum.currentPrice as number | null) || 0;
  const avgAuctionValue = completedAuctions > 0 ? Math.round(totalGMV / completedAuctions) : 0;

  // Avg time to first bid (sample last 50 auctions with bids)
  const auctionsForTTFB = await prisma.auction.findMany({
    where: { bids: { some: {} } },
    select: {
      createdAt: true,
      bids: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  let avgTimeToFirstBidHours = 0;
  if (auctionsForTTFB.length > 0) {
    const totalMs = auctionsForTTFB.reduce((acc, a) => {
      if (a.bids[0]) {
        return acc + (a.bids[0].createdAt.getTime() - a.createdAt.getTime());
      }
      return acc;
    }, 0);
    avgTimeToFirstBidHours = Math.round((totalMs / auctionsForTTFB.length / (1000 * 60 * 60)) * 10) / 10;
  }

  // Daily bids (last 30 days)
  const dailyBidsMap = new Map<string, number>();
  const dailySignupsMap = new Map<string, number>();

  // Initialize all 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    dailyBidsMap.set(key, 0);
    dailySignupsMap.set(key, 0);
  }

  recentBids.forEach(b => {
    const key = b.createdAt.toISOString().split('T')[0];
    dailyBidsMap.set(key, (dailyBidsMap.get(key) || 0) + 1);
  });

  // Signups
  const recentSignups = await prisma.user.findMany({
    select: { createdAt: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
  });
  recentSignups.forEach(u => {
    const key = u.createdAt.toISOString().split('T')[0];
    dailySignupsMap.set(key, (dailySignupsMap.get(key) || 0) + 1);
  });

  return {
    totalUsers,
    totalAuctions,
    activeAuctions,
    completedAuctions,
    totalBids,
    totalGMV,
    liquidityRate,
    sellThroughRate,
    repeatSellerRate,
    avgBidsPerAuction,
    avgTimeToFirstBidHours,
    avgAuctionValue,
    newUsersLast7Days: newUsers7d,
    newUsersLast30Days: newUsers30d,
    bidsLast7Days: bids7d,
    bidsLast30Days: bids30d,
    topCategories: categoryData.map(c => ({ category: c.category, count: c._count })),
    dailyBids: Array.from(dailyBidsMap).map(([date, count]) => ({ date, count })),
    dailySignups: Array.from(dailySignupsMap).map(([date, count]) => ({ date, count })),
  };
}
