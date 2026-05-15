'use server';

import { db, toDate } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { User } from '@/types';
import { revalidatePath } from 'next/cache';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

export async function grantVerifiedSeller(userId: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();
    await db.collection('users').doc(userId).update({
      isVerifiedSeller: true, 
      updatedAt: new Date(),
    });
    
    await db.collection('admin_logs').add({
      adminId: session.user.id, action: 'GRANT_SELLER', targetId: userId, createdAt: new Date()
    });

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to grant verified status');
  }
}

export async function revokeVerifiedSeller(userId: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();
    await db.collection('users').doc(userId).update({
      isVerifiedSeller: false, updatedAt: new Date(),
    });

    await db.collection('admin_logs').add({
      adminId: session.user.id, action: 'REVOKE_SELLER', targetId: userId, createdAt: new Date()
    });

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to revoke verified status');
  }
}

export async function banUser(userId: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();
    await db.collection('users').doc(userId).update({
      isBanned: true, updatedAt: new Date(),
    });

    await db.collection('admin_logs').add({
      adminId: session.user.id, action: 'BAN_USER', targetId: userId, createdAt: new Date()
    });

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to ban user');
  }
}

export async function unbanUser(userId: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();
    await db.collection('users').doc(userId).update({
      isBanned: false, updatedAt: new Date(),
    });

    await db.collection('admin_logs').add({
      adminId: session.user.id, action: 'UNBAN_USER', targetId: userId, createdAt: new Date()
    });

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to unban user');
  }
}

export async function getAdminUsers(opts: {
  cursor?: string | null;
  limit?: number;
  search?: string;
} = {}): Promise<ServiceResponse<{ users: unknown[], nextCursor: string | null, hasMore: boolean }>> {
  try {
    await requireAdmin();
    const limit = opts.limit ?? 20;

    let query: FirebaseFirestore.Query = db.collection('users');

    if (opts.search?.trim()) {
      const s = opts.search.trim().toLowerCase();
      query = query.where('nameLowercase', '>=', s).where('nameLowercase', '<=', s + '\uf8ff');
    }

    query = query.orderBy('createdAt', 'desc');

    if (opts.cursor) {
      const cursorSnap = await db.collection('users').doc(opts.cursor).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const usersSnap = await query.limit(limit + 1).get();
    const allDocs = usersSnap.docs;
    const hasMore = allDocs.length > limit;
    const pageDocs = hasMore ? allDocs.slice(0, limit) : allDocs;
    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

    const pagedUsers = await Promise.all(pageDocs.map(async (doc) => {
      const data = doc.data()!;

      return {
        id: doc.id,
        name: (data.name as string) ?? null,
        email: (data.email as string) ?? null,
        image: (data.image as string) ?? null,
        isVerifiedSeller: !!data.isVerifiedSeller,
        rating: (data.rating as number) ?? 0,
        ratingCount: (data.ratingCount as number) ?? 0,
        isBanned: !!data.isBanned,
        isTopRated: !!data.isTopRated,
        salesCount: (data.salesCount as number) ?? 0,
        isRetailer: !!data.isRetailer,
        userLevel: (data.userLevel as number) ?? 1,
        winningStreak: (data.winningStreak as number) ?? 0,
        createdAt: toDate(data.createdAt as FirebaseFirestore.Timestamp | Date | string | null | undefined),
        _count: {
          bids: (data.bidCount as number) ?? 0,
          auctionsAsSeller: (data.auctionCount as number) ?? 0,
        },
      };
    }));

    return successResponse({ users: pagedUsers, nextCursor, hasMore });
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch users');
  }
}
