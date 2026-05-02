import { db, snapDocs } from '@/lib/db';
import { AuctionStatus, type User } from '@/types';
import { log } from '@/lib/logger';
import { ErrorType, AppError } from '@/lib/errors';

/**
 * AdminService — Pure business logic for administrative operations.
 * Separated from Server Actions to enable reuse in CRON jobs or other services.
 */
export class AdminService {
  /**
   * Fetches high-level metrics for the admin dashboard.
   * Optimized with Firestore aggregations.
   */
  static async getDashboardStats() {
    try {
      const [userCountSnap, activeAuctionCountSnap, totalAuctionCountSnap, bidCountSnap, verifiedUserCountSnap] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('auctions').where('status', '==', AuctionStatus.ACTIVE).count().get(),
        db.collection('auctions').count().get(),
        db.collection('bids').count().get(),
        db.collection('users').where('isPhoneVerified', '==', true).count().get(),
      ]);

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
        rating: Number(user.rating ?? 0),
        ratingCount: Number(user.ratingCount ?? 0),
        createdAt: user.createdAt,
      }));

      const statsSnap = await db.collection('stats').doc('global').get();
      const totalRevenue = Number(statsSnap.data()?.totalRevenue ?? 0);

      return {
        totalUsers: userCountSnap.data().count,
        verifiedUsers: verifiedUserCountSnap.data().count,
        totalAuctions: totalAuctionCountSnap.data().count,
        activeAuctions: activeAuctionCountSnap.data().count,
        totalBids: bidCountSnap.data().count,
        totalRevenue,
        recentUsers,
      };
    } catch (e) {
      log.error('[AdminService] getDashboardStats failed', e);
      throw new AppError(ErrorType.INTERNAL, 'Failed to aggregate dashboard metrics');
    }
  }

  /**
   * Updates a user's verification status and logs the administrative action.
   */
  static async toggleUserVerification(adminId: string, userId: string, reason: string) {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new AppError(ErrorType.NOT_FOUND, 'User not found');
    }

    const current = Boolean(userSnap.data()?.isVerifiedSeller);
    const next = !current;
    const now = new Date();

    const batch = db.batch();
    batch.update(userRef, { isVerifiedSeller: next, updatedAt: now });
    
    const logRef = db.collection('admin_logs').doc();
    batch.set(logRef, {
      adminId,
      action: next ? 'GRANT_VERIFIED_SELLER' : 'REVOKE_VERIFIED_SELLER',
      targetId: userId,
      details: { previous: current, next, reason },
      createdAt: now,
    });

    await batch.commit();
    return { isVerifiedSeller: next };
  }
}
