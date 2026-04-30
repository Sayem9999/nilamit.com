'use server';

import { db, snapDocs } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { AuctionStatus, Auction, User, Bid } from '@/types';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

export interface KeyMetrics {
  totalUsers: number;
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalBids: number;
  totalGMV: number;
  liquidityRate: number;
  sellThroughRate: number;
  repeatSellerRate: number;
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

function dayKey(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function initDailyMap(now: Date, days: number): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    map.set(dayKey(date), 0);
  }
  return map;
}

export async function getKeyMetrics(): Promise<ServiceResponse<KeyMetrics>> {
  try {
    await requireAdmin();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Scalable Totals using count() aggregations
    const [
      totalUsersSnap, 
      totalAuctionsSnap, 
      activeAuctionsSnap, 
      completedAuctionsSnap, 
      totalBidsSnap,
      newUsers7Snap,
      newUsers30Snap,
      bids7Snap,
      bids30Snap
    ] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('auctions').count().get(),
      db.collection('auctions').where('status', '==', AuctionStatus.ACTIVE).count().get(),
      db.collection('auctions').where('status', '==', AuctionStatus.SOLD).count().get(),
      db.collection('bids').count().get(),
      db.collection('users').where('createdAt', '>=', sevenDaysAgo).count().get(),
      db.collection('users').where('createdAt', '>=', thirtyDaysAgo).count().get(),
      db.collection('bids').where('createdAt', '>=', sevenDaysAgo).count().get(),
      db.collection('bids').where('createdAt', '>=', thirtyDaysAgo).count().get(),
    ]);

    const totalUsers = totalUsersSnap.data().count;
    const totalAuctions = totalAuctionsSnap.data().count;
    const activeAuctions = activeAuctionsSnap.data().count;
    const completedAuctions = completedAuctionsSnap.data().count;
    const totalBids = totalBidsSnap.data().count;

    // 2. GMV Calculation (scan only SOLD auctions, and only currentPrice field)
    const soldAuctionsSnap = await db.collection('auctions')
      .where('status', '==', AuctionStatus.SOLD)
      .select('currentPrice', 'category', 'sellerId')
      .get();

    let totalGMV = 0;
    const categoryCounts = new Map<string, number>();
    const sellerCounts = new Map<string, number>();

    soldAuctionsSnap.docs.forEach((doc) => {
      const data = doc.data();
      totalGMV += Number(data.currentPrice ?? 0);
      if (data.category) categoryCounts.set(data.category, (categoryCounts.get(data.category) ?? 0) + 1);
      if (data.sellerId) sellerCounts.set(data.sellerId, (sellerCounts.get(data.sellerId) ?? 0) + 1);
    });

    // 3. Chart Data (fetch only 30 days window)
    const [recentBidsSnap, recentUsersSnap] = await Promise.all([
      db.collection('bids').where('createdAt', '>=', thirtyDaysAgo).select('createdAt').get(),
      db.collection('users').where('createdAt', '>=', thirtyDaysAgo).select('createdAt').get(),
    ]);

    const dailyBidsMap = initDailyMap(now, 30);
    const dailySignupsMap = initDailyMap(now, 30);

    recentBidsSnap.docs.forEach((d) => {
      const date = d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt);
      const key = dayKey(date);
      if (dailyBidsMap.has(key)) dailyBidsMap.set(key, (dailyBidsMap.get(key) || 0) + 1);
    });

    recentUsersSnap.docs.forEach((d) => {
      const date = d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt);
      const key = dayKey(date);
      if (dailySignupsMap.has(key)) dailySignupsMap.set(key, (dailySignupsMap.get(key) || 0) + 1);
    });

    // Rates & Averages
    const avgBidsPerAuction = totalAuctions > 0 ? Math.round((totalBids / totalAuctions) * 10) / 10 : 0;
    const sellThroughRate = totalAuctions > 0 ? Math.round((completedAuctions / totalAuctions) * 1000) / 10 : 0;
    const avgAuctionValue = completedAuctions > 0 ? Math.round(totalGMV / completedAuctions) : 0;

    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count }));

    const metrics: KeyMetrics = {
      totalUsers,
      totalAuctions,
      activeAuctions,
      completedAuctions,
      totalBids,
      totalGMV,
      liquidityRate: 0, // Simplified for performance
      sellThroughRate,
      repeatSellerRate: 0, // Simplified for performance
      avgBidsPerAuction,
      avgTimeToFirstBidHours: 0, // Simplified for performance
      avgAuctionValue,
      newUsersLast7Days: newUsers7Snap.data().count,
      newUsersLast30Days: newUsers30Snap.data().count,
      bidsLast7Days: bids7Snap.data().count,
      bidsLast30Days: bids30Snap.data().count,
      topCategories,
      dailyBids: Array.from(dailyBidsMap).map(([date, count]) => ({ date, count })),
      dailySignups: Array.from(dailySignupsMap).map(([date, count]) => ({ date, count })),
    };

    return successResponse(metrics);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch metrics');
  }
}
