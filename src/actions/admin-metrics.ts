'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus } from '@/types';

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

function readDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

export async function getKeyMetrics(): Promise<KeyMetrics> {
  await requireAdmin();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [usersSnap, auctionsSnap, bidsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('auctions').get(),
    db.collection('bids').get(),
  ]);

  const users = usersSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
    createdAt: readDate(doc.data().createdAt),
  }));

  const auctions = auctionsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
    createdAt: readDate(doc.data().createdAt),
  }));

  const bids = bidsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
    createdAt: readDate(doc.data().createdAt),
  }));

  const totalUsers = users.length;
  const totalAuctions = auctions.length;
  const activeAuctions = auctions.filter((auction) => auction.status === AuctionStatus.ACTIVE).length;
  const soldAuctions = auctions.filter((auction) => auction.status === AuctionStatus.SOLD);
  const completedAuctions = soldAuctions.length;
  const totalBids = bids.length;

  const auctionsWithBidIds = new Set(
    bids
      .map((bid) => bid.auctionId)
      .filter((auctionId): auctionId is string => typeof auctionId === 'string' && auctionId.length > 0)
  );
  const auctionsWithBids = auctionsWithBidIds.size;

  const sellerCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let totalGMV = 0;

  for (const auction of auctions) {
    if (typeof auction.sellerId === 'string' && auction.sellerId) {
      sellerCounts.set(auction.sellerId, (sellerCounts.get(auction.sellerId) ?? 0) + 1);
    }
    if (typeof auction.category === 'string' && auction.category) {
      categoryCounts.set(auction.category, (categoryCounts.get(auction.category) ?? 0) + 1);
    }
    if (auction.status === AuctionStatus.SOLD) {
      totalGMV += Number(auction.currentPrice ?? 0);
    }
  }

  const newUsers7d = users.filter((user) => user.createdAt && user.createdAt >= sevenDaysAgo).length;
  const newUsers30d = users.filter((user) => user.createdAt && user.createdAt >= thirtyDaysAgo).length;
  const bids7d = bids.filter((bid) => bid.createdAt && bid.createdAt >= sevenDaysAgo).length;
  const bids30d = bids.filter((bid) => bid.createdAt && bid.createdAt >= thirtyDaysAgo).length;

  const avgBidsPerAuction = totalAuctions > 0 ? Math.round((totalBids / totalAuctions) * 10) / 10 : 0;
  const liquidityRate = totalAuctions > 0 ? Math.round((auctionsWithBids / totalAuctions) * 1000) / 10 : 0;
  const sellThroughRate = totalAuctions > 0 ? Math.round((completedAuctions / totalAuctions) * 1000) / 10 : 0;
  const repeatSellers = [...sellerCounts.values()].filter((count) => count > 1).length;
  const repeatSellerRate = sellerCounts.size > 0 ? Math.round((repeatSellers / sellerCounts.size) * 1000) / 10 : 0;
  const avgAuctionValue = completedAuctions > 0 ? Math.round(totalGMV / completedAuctions) : 0;

  const firstBidByAuction = new Map<string, Date>();
  for (const bid of bids) {
    if (!bid.createdAt || typeof bid.auctionId !== 'string') continue;
    const existing = firstBidByAuction.get(bid.auctionId);
    if (!existing || bid.createdAt < existing) {
      firstBidByAuction.set(bid.auctionId, bid.createdAt);
    }
  }

  let avgTimeToFirstBidHours = 0;
  const auctionsForTTFB = auctions
    .filter((auction) => auction.createdAt && firstBidByAuction.has(auction.id))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 50);

  if (auctionsForTTFB.length > 0) {
    const totalMs = auctionsForTTFB.reduce((sum, auction) => {
      const firstBid = firstBidByAuction.get(auction.id);
      if (!auction.createdAt || !firstBid) return sum;
      return sum + Math.max(firstBid.getTime() - auction.createdAt.getTime(), 0);
    }, 0);
    avgTimeToFirstBidHours = Math.round((totalMs / auctionsForTTFB.length / (1000 * 60 * 60)) * 10) / 10;
  }

  const dailyBidsMap = initDailyMap(now, 30);
  const dailySignupsMap = initDailyMap(now, 30);

  bids.forEach((bid) => {
    if (!bid.createdAt || bid.createdAt < thirtyDaysAgo) return;
    const key = dayKey(bid.createdAt);
    dailyBidsMap.set(key, (dailyBidsMap.get(key) || 0) + 1);
  });

  users.forEach((user) => {
    if (!user.createdAt || user.createdAt < thirtyDaysAgo) return;
    const key = dayKey(user.createdAt);
    dailySignupsMap.set(key, (dailySignupsMap.get(key) || 0) + 1);
  });

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }));

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
    topCategories,
    dailyBids: Array.from(dailyBidsMap).map(([date, count]) => ({ date, count })),
    dailySignups: Array.from(dailySignupsMap).map(([date, count]) => ({ date, count })),
  };
}
