'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { User } from '@/types';
import { revalidatePath } from 'next/cache';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

export async function grantVerifiedSeller(userId: string) {
  try {
    const session = await requireAdmin();
    await db.collection('users').doc(userId).update({
      isVerifiedSeller: true, updatedAt: new Date(),
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

export async function revokeVerifiedSeller(userId: string) {
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

export async function banUser(userId: string) {
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

export async function unbanUser(userId: string) {
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
} = {}) {
  try {
    await requireAdmin();
    const limit = opts.limit ?? 20;

    let query: FirebaseFirestore.Query = db.collection('users');

    if (opts.search?.trim()) {
      const s = opts.search.trim();
      query = query.where('name', '>=', s).where('name', '<=', s + '\uf8ff');
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

    const users = pageDocs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id })) as unknown as User[];

    const pagedUsers = await Promise.all(users.map(async (user) => {
      const [bidCountSnap, auctionCountSnap] = await Promise.all([
        db.collection('bids').where('bidderId', '==', user.id).count().get(),
        db.collection('auctions').where('sellerId', '==', user.id).count().get(),
      ]);

      return {
        ...user,
        _count: {
          bids: bidCountSnap.data().count,
          auctionsAsSeller: auctionCountSnap.data().count,
        },
        password: undefined,
      };
    }));

    return successResponse({ users: pagedUsers, nextCursor, hasMore });
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch users');
  }
}
