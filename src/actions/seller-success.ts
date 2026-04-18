'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function getSellerPerformance() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [allAuctionsSnap, soldSnap, activeSnap, userSnap] = await Promise.all([
    db.collection('auctions').where('sellerId', '==', userId).get(),
    db.collection('auctions').where('sellerId', '==', userId).where('status', '==', 'SOLD').get(),
    db.collection('auctions').where('sellerId', '==', userId).where('status', '==', 'ACTIVE').get(),
    db.collection('users').doc(userId).get(),
  ]);

  const userData = userSnap.data() ?? {};
  const reputationScore = typeof userData.reputationScore === 'number' ? userData.reputationScore : 0;
  const averageRating   = typeof userData.averageRating   === 'number' ? userData.averageRating   : 0;
  const reviewCount     = typeof userData.reviewCount     === 'number' ? userData.reviewCount     : 0;

  const auctionIds = allAuctionsSnap.docs.map(d => d.id);
  const totalAuctions  = allAuctionsSnap.size;
  const soldCount      = soldSnap.size;
  const activeAuctions = activeSnap.size;

  // Revenue
  let totalRevenue = 0;
  soldSnap.docs.forEach(d => { totalRevenue += d.data().currentPrice ?? 0; });
  const avgSalePrice = soldCount > 0 ? Math.round(totalRevenue / soldCount) : 0;

  // Bids per auction (batch in chunks of 30 due to Firestore 'in' limit)
  let totalBids = 0;
  const chunks: string[][] = [];
  for (let i = 0; i < auctionIds.length; i += 30) chunks.push(auctionIds.slice(i, i + 30));

  const bidCounts: Record<string, number> = {};
  await Promise.all(chunks.map(async chunk => {
    if (chunk.length === 0) return;
    const snap = await db.collection('bids').where('auctionId', 'in', chunk).get();
    snap.docs.forEach(d => {
      totalBids++;
      bidCounts[d.data().auctionId] = (bidCounts[d.data().auctionId] ?? 0) + 1;
    });
  }));

  const avgBidsPerAuction = totalAuctions > 0 ? Math.round((totalBids / totalAuctions) * 10) / 10 : 0;
  const sellThroughRate   = totalAuctions > 0 ? Math.round((soldCount / totalAuctions) * 1000) / 10 : 0;
  const liquidityRate     = totalAuctions > 0
    ? Math.round((Object.keys(bidCounts).length / totalAuctions) * 1000) / 10 : 0;

  // Revenue by day (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const revenueByDay: Record<string, number> = {};
  soldSnap.docs.forEach(d => {
    const updatedAt = d.data().updatedAt?.toDate?.() ?? new Date(d.data().updatedAt);
    if (updatedAt >= thirtyDaysAgo) {
      const key = updatedAt.toISOString().split('T')[0];
      revenueByDay[key] = (revenueByDay[key] ?? 0) + (d.data().currentPrice ?? 0);
    }
  });

  // Category performance
  const catMap: Record<string, { revenue: number; count: number }> = {};
  soldSnap.docs.forEach(d => {
    const cat = d.data().category ?? 'other';
    if (!catMap[cat]) catMap[cat] = { revenue: 0, count: 0 };
    catMap[cat].revenue += d.data().currentPrice ?? 0;
    catMap[cat].count++;
  });

  return {
    totalRevenue, totalAuctions, activeAuctions, soldCount, sellThroughRate,
    liquidityRate, avgBidsPerAuction, avgSalePrice,
    reputationScore, averageRating, reviewCount,
    bidVelocity: 0, // placeholder
    revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
    categoryPerformance: Object.entries(catMap).map(([category, v]) => ({ category, ...v })),
  };
}
