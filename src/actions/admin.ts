'use server';

import { db, snapDocs } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { AuctionStatus, type User } from '@/types';

/**
 * Admin Dashboard Core Stats
 * Optimized with Firestore aggregations to minimize billing and data transfer.
 */
export async function getAdminStats() {
  await requireAdmin();

  // 1. Efficient counts using aggregation (bills only 1 read per 1000 docs)
  const [userCountSnap, activeAuctionCountSnap, bidCountSnap, verifiedUserCountSnap] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('auctions').where('status', '==', AuctionStatus.ACTIVE).count().get(),
    db.collection('bids').count().get(),
    db.collection('users').where('isPhoneVerified', '==', true).count().get(),
  ]);

  // 2. Fetch only the data we need for the UI (recent users)
  const recentUsersSnap = await db.collection('users')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const recentUsers = snapDocs<User>(recentUsersSnap).map((user) => ({
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    isPhoneVerified: Boolean(user.isPhoneVerified),
    isVerifiedSeller: Boolean(user.isVerifiedSeller),
    reputationScore: Number(user.reputationScore ?? 0),
    createdAt: user.createdAt,
  }));

  // 3. Revenue calculation
  // Currently scans SOLD auctions. Consider a dedicated stats document for scaling.
  const soldAuctionsSnap = await db.collection('auctions')
    .where('status', '==', AuctionStatus.SOLD)
    .select('commissionEarned')
    .get();

  const totalRevenue = soldAuctionsSnap.docs.reduce((sum, doc) => {
    return sum + Number(doc.data().commissionEarned ?? 0);
  }, 0);

  return {
    totalUsers: userCountSnap.data().count,
    verifiedUsers: verifiedUserCountSnap.data().count,
    totalAuctions: null, 
    activeAuctions: activeAuctionCountSnap.data().count,
    totalBids: bidCountSnap.data().count,
    totalRevenue,
    recentUsers,
  };
}
