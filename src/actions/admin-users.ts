'use server';

import { db, snapDocs } from '@/lib/db';
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

export async function getAdminUsers(page = 1, limit = 20, search?: string) {
  await requireAdmin();

  let query: FirebaseFirestore.Query = db.collection('users');

  if (search?.trim()) {
    const s = search.trim();
    // Case-insensitive prefix search is hard in Firestore. 
    // This is a simple prefix search (case-sensitive).
    query = query.where('name', '>=', s).where('name', '<=', s + '\uf8ff');
  }

  const totalSnap = await query.count().get();
  const total = totalSnap.data().count;

  const usersSnap = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset((page - 1) * limit)
    .get();

  const users = snapDocs<User>(usersSnap);

  // Fetch counts ONLY for the users on this page (targeted sub-queries)
  const pagedUsers = await Promise.all(users.map(async (user) => {
    const [bidCountSnap, auctionCountSnap] = await Promise.all([
      db.collection('bids').where('bidderId', '==', user.id).count().get(),
      db.collection('auctions').where('sellerId', '==', user.id).count().get(),
    ]);

    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      image: user.image ?? null,
      isPhoneVerified: Boolean(user.isPhoneVerified),
      isVerifiedSeller: Boolean(user.isVerifiedSeller),
      reputationScore: Number(user.reputationScore ?? 0),
      createdAt: user.createdAt,
      isBanned: Boolean(user.isBanned),
      _count: {
        bids: bidCountSnap.data().count,
        auctionsAsSeller: auctionCountSnap.data().count,
      },
      password: undefined,
    };
  }));

  return { success: true, users: pagedUsers, total, pages: Math.ceil(total / limit) };
}
