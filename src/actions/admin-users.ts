'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { User } from '@/types';
import { revalidatePath } from 'next/cache';

export async function grantVerifiedSeller(userId: string) {
  const session = await requireAdmin();
  await db.collection('users').doc(userId).update({
    isVerifiedSeller: true, updatedAt: new Date(),
  });
  
  await db.collection('admin_logs').add({
    adminId: session.user.id, action: 'GRANT_SELLER', targetId: userId, createdAt: new Date()
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function revokeVerifiedSeller(userId: string) {
  const session = await requireAdmin();
  await db.collection('users').doc(userId).update({
    isVerifiedSeller: false, updatedAt: new Date(),
  });

  await db.collection('admin_logs').add({
    adminId: session.user.id, action: 'REVOKE_SELLER', targetId: userId, createdAt: new Date()
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function banUser(userId: string) {
  const session = await requireAdmin();
  await db.collection('users').doc(userId).update({
    isBanned: true, updatedAt: new Date(),
  });

  await db.collection('admin_logs').add({
    adminId: session.user.id, action: 'BAN_USER', targetId: userId, createdAt: new Date()
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function unbanUser(userId: string) {
  const session = await requireAdmin();
  await db.collection('users').doc(userId).update({
    isBanned: false, updatedAt: new Date(),
  });

  await db.collection('admin_logs').add({
    adminId: session.user.id, action: 'UNBAN_USER', targetId: userId, createdAt: new Date()
  });

  revalidatePath('/admin');
  return { success: true };
}

/**
 * Cursor-paginated admin user listing.
 *
 * Why cursor instead of offset: Firestore's `.offset(n)` reads (and bills for)
 * every skipped document. On a `users` collection that grows without bound,
 * page 50 means scanning 1000 docs server-side just to throw them away. Using
 * `startAfter(cursor)` is O(1) per page regardless of position.
 *
 * Cursor = the previous page's last user `id`. We reconstruct the doc snapshot
 * with `db.collection('users').doc(cursor).get()`.
 */
export async function getAdminUsers(opts: {
  cursor?: string | null;
  limit?: number;
  search?: string;
} = {}) {
  await requireAdmin();
  const limit = opts.limit ?? 20;

  let query: FirebaseFirestore.Query = db.collection('users');

  if (opts.search?.trim()) {
    const s = opts.search.trim();
    // Case-sensitive prefix search. The composite index for this is
    // (name ASC, createdAt DESC) — see firestore.indexes.json.
    query = query.where('name', '>=', s).where('name', '<=', s + '\uf8ff');
  }

  query = query.orderBy('createdAt', 'desc');

  if (opts.cursor) {
    const cursorSnap = await db.collection('users').doc(opts.cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  // Fetch one extra to know if there's another page.
  const usersSnap = await query.limit(limit + 1).get();
  const allDocs = usersSnap.docs;
  const hasMore = allDocs.length > limit;
  const pageDocs = hasMore ? allDocs.slice(0, limit) : allDocs;
  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

  const users = pageDocs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id })) as unknown as User[];

  // Fetch counts ONLY for the users on this page (targeted sub-queries)
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

  return { success: true, users: pagedUsers, nextCursor, hasMore };
}
