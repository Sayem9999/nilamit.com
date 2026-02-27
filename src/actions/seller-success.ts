'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus } from '@prisma/client';

/**
 * Seller Success Center Analytics
 * Provides deep insights for sellers to optimize their auction performance.
 */

export interface SellerPerformanceMetrics {
  totalRevenue: number;
  totalAuctions: number;
  activeAuctions: number;
  soldCount: number;
  sellThroughRate: number;      // % of auctions reaching 'SOLD' status
  liquidityRate: number;        // % of auctions with at least one bid
  avgBidsPerAuction: number;
  avgSalePrice: number;
  bidVelocity: number;          // Average bids received per hour across active auctions
  reputationGrowth: number;     // Recent changes in reputation score
  revenueByDay: { date: string; amount: number }[];
  categoryPerformance: { category: string; count: number; revenue: number }[];
}

export async function getSellerPerformance(): Promise<SellerPerformanceMetrics | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  // 1. Core Counts & GMV
  const [
    auctions,
    totalBidsCount,
    soldAuctions,
    user
  ] = await Promise.all([
    prisma.auction.findMany({
      where: { sellerId: userId },
      include: { _count: { select: { bids: true } } }
    }),
    prisma.bid.count({
      where: { auction: { sellerId: userId } }
    }),
    prisma.auction.findMany({
      where: { sellerId: userId, status: AuctionStatus.SOLD },
      select: { currentPrice: true, updatedAt: true, category: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true, createdAt: true }
    })
  ]);

  const totalAuctions = auctions.length;
  if (totalAuctions === 0) {
    return {
      totalRevenue: 0,
      totalAuctions: 0,
      activeAuctions: 0,
      soldCount: 0,
      sellThroughRate: 0,
      liquidityRate: 0,
      avgBidsPerAuction: 0,
      avgSalePrice: 0,
      bidVelocity: 0,
      reputationGrowth: 0,
      revenueByDay: [],
      categoryPerformance: []
    };
  }

  const activeAuctions = auctions.filter(a => a.status === AuctionStatus.ACTIVE).length;
  const soldCount = soldAuctions.length;
  const totalRevenue = soldAuctions.reduce((acc, a) => acc + a.currentPrice, 0);
  const auctionsWithBids = auctions.filter(a => a._count.bids > 0).length;

  // 2. Calculated Metrics
  const sellThroughRate = (soldCount / totalAuctions) * 100;
  const liquidityRate = (auctionsWithBids / totalAuctions) * 100;
  const avgBidsPerAuction = totalBidsCount / totalAuctions;
  const avgSalePrice = soldCount > 0 ? totalRevenue / soldCount : 0;

  // 3. Bid Velocity (High-end metric)
  // Approximate bids/hour across all auctions in their active windows
  const totalActiveHours = auctions.reduce((acc, a) => {
    const duration = a.endTime.getTime() - a.startTime.getTime();
    return acc + Math.max(duration / (1000 * 60 * 60), 1);
  }, 0);
  const bidVelocity = totalBidsCount / totalActiveHours;

  // 4. Revenue By Day (Last 30 days)
  const revenueMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    revenueMap.set(d.toISOString().split('T')[0], 0);
  }

  soldAuctions.forEach(a => {
    const key = a.updatedAt.toISOString().split('T')[0];
    if (revenueMap.has(key)) {
      revenueMap.set(key, (revenueMap.get(key) || 0) + a.currentPrice);
    }
  });

  const revenueByDay = Array.from(revenueMap.entries()).map(([date, amount]) => ({ date, amount }));

  // 5. Category Performance
  const catMap = new Map<string, { count: number; revenue: number }>();
  auctions.forEach(a => {
    const stats = catMap.get(a.category) || { count: 0, revenue: 0 };
    stats.count++;
    if (a.status === AuctionStatus.SOLD) stats.revenue += a.currentPrice;
    catMap.set(a.category, stats);
  });

  const categoryPerformance = Array.from(catMap.entries()).map(([category, stats]) => ({
    category,
    count: stats.count,
    revenue: stats.revenue
  })).sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    totalAuctions,
    activeAuctions,
    soldCount,
    sellThroughRate: Math.round(sellThroughRate * 10) / 10,
    liquidityRate: Math.round(liquidityRate * 10) / 10,
    avgBidsPerAuction: Math.round(avgBidsPerAuction * 10) / 10,
    avgSalePrice: Math.round(avgSalePrice),
    bidVelocity: Math.round(bidVelocity * 100) / 100,
    reputationGrowth: user?.reputationScore || 0,
    revenueByDay,
    categoryPerformance
  };
}
