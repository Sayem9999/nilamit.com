'use server';

import { db, FieldValue } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionStatus, type OrderStatus } from '@/types';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
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

async function getUserMap(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const snaps = await Promise.all(uniqueIds.map((userId) => db.collection('users').doc(userId).get()));
  return new Map(
    snaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as Record<string, unknown>])
  );
}

export async function getAdminStats() {
  await requireAdmin();

  const [usersSnap, auctionsSnap, bidsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('auctions').get(),
    db.collection('bids').get(),
  ]);

  const users = usersSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, any>),
    createdAt: readDate(doc.data().createdAt),
  } as { id: string; createdAt: Date | null; [key: string]: any }));
  const auctions = auctionsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, any>),
  } as { id: string; [key: string]: any }));

  const recentUsers = users
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 10)
    .map((user) => ({
      id: user.id,
      name: (user.name as string | null) ?? null,
      email: (user.email as string | null) ?? null,
      isPhoneVerified: Boolean(user.isPhoneVerified),
      isVerifiedSeller: Boolean(user.isVerifiedSeller),
      reputationScore: Number(user.reputationScore ?? 0),
      createdAt: user.createdAt ?? new Date(0),
    }));

  const totalRevenue = auctions.reduce((sum, auction) => {
    if (auction.status !== AuctionStatus.SOLD) return sum;
    return sum + Number(auction.commissionEarned ?? 0);
  }, 0);

  return {
    totalUsers: users.length,
    verifiedUsers: users.filter((user) => Boolean(user.isPhoneVerified)).length,
    totalAuctions: auctions.length,
    activeAuctions: auctions.filter((auction) => auction.status === AuctionStatus.ACTIVE).length,
    totalBids: bidsSnap.size,
    totalRevenue,
    recentUsers,
  };
}

export async function getAdminUsers(page = 1, limit = 20, search?: string) {
  await requireAdmin();

  const [usersSnap, auctionsSnap, bidsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('auctions').get(),
    db.collection('bids').get(),
  ]);

  const auctionCounts = new Map<string, number>();
  auctionsSnap.docs.forEach((doc) => {
    const sellerId = doc.data().sellerId as string | undefined;
    if (sellerId) auctionCounts.set(sellerId, (auctionCounts.get(sellerId) ?? 0) + 1);
  });

  const bidCounts = new Map<string, number>();
  bidsSnap.docs.forEach((doc) => {
    const bidderId = doc.data().bidderId as string | undefined;
    if (bidderId) bidCounts.set(bidderId, (bidCounts.get(bidderId) ?? 0) + 1);
  });

  const normalizedSearch = search?.trim().toLowerCase();
  const users = usersSnap.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
      createdAt: readDate(doc.data().createdAt),
    } as { id: string; createdAt: Date | null; [key: string]: any }))
    .filter((user) => {
      if (!normalizedSearch) return true;
      const haystack = [user.name, user.email, user.phone]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());
      return haystack.some((value) => value.includes(normalizedSearch));
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const total = users.length;
  const pagedUsers = users.slice((page - 1) * limit, page * limit).map((user) => ({
    id: user.id,
    name: (user.name as string | null) ?? null,
    email: (user.email as string | null) ?? null,
    phone: (user.phone as string | null) ?? null,
    isPhoneVerified: Boolean(user.isPhoneVerified),
    isVerifiedSeller: Boolean(user.isVerifiedSeller),
    reputationScore: Number(user.reputationScore ?? 0),
    createdAt: user.createdAt ?? new Date(0),
    _count: {
      bids: bidCounts.get(user.id) ?? 0,
      auctionsAsSeller: auctionCounts.get(user.id) ?? 0,
    },
    password: undefined,
  }));

  return { users: pagedUsers, total, pages: Math.ceil(total / limit) };
}

export async function getAdminAuctions(page = 1, limit = 20, status?: string) {
  await requireAdmin();

  const auctionsSnap = await db.collection('auctions').get();
  const filteredAuctions = auctionsSnap.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
      createdAt: readDate(doc.data().createdAt),
    } as { id: string; createdAt: Date | null; [key: string]: any }))
    .filter((auction) => !status || auction.status === status)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const total = filteredAuctions.length;
  const pagedAuctions = filteredAuctions.slice((page - 1) * limit, page * limit);
  const sellerMap = await getUserMap(
    pagedAuctions
      .map((auction) => auction.sellerId)
      .filter((sellerId): sellerId is string => typeof sellerId === 'string')
  );

  const auctions = pagedAuctions.map((auction) => ({
    ...auction,
    seller: {
      name: (sellerMap.get(auction.sellerId as string)?.name as string | null) ?? null,
      email: (sellerMap.get(auction.sellerId as string)?.email as string | null) ?? null,
    },
    _count: {
      bids: Number(auction.bidCount ?? 0),
    },
  }));

  return { auctions, total, pages: Math.ceil(total / limit) };
}

export async function adminUpdateUser(userId: string, data: { reputationScore?: number; isPhoneVerified?: boolean }) {
  await requireAdmin();
  await db.collection('users').doc(userId).update({ ...data, updatedAt: new Date() });
  const updated = await db.collection('users').doc(userId).get();
  return { id: updated.id, ...updated.data() };
}

export async function adminToggleVerification(userId: string) {
  await requireAdmin();
  const user = await db.collection('users').doc(userId).get();
  if (!user.exists) throw new Error('User not found');

  const nextValue = !Boolean(user.data()?.isVerifiedSeller);
  await db.collection('users').doc(userId).update({
    isVerifiedSeller: nextValue,
    updatedAt: new Date(),
  });

  return { success: true, isVerifiedSeller: nextValue };
}

export async function adminUpdateDelivery(auctionId: string, status: OrderStatus, trackingNumber?: string) {
  await requireAdmin();

  await db.collection('auctions').doc(auctionId).update({
    deliveryStatus: status,
    trackingNumber: trackingNumber ?? null,
    updatedAt: new Date(),
  });

  const updated = await db.collection('auctions').doc(auctionId).get();
  return { id: updated.id, ...updated.data() };
}

export async function adminCancelAuction(auctionId: string) {
  await requireAdmin();
  await db.collection('auctions').doc(auctionId).update({
    status: AuctionStatus.CANCELLED,
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function getAdminDisputes() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', '==', 'DISPUTED')
    .orderBy('createdAt', 'desc')
    .get();

  return Promise.all(txSnap.docs.map(async (doc) => {
    const tx = doc.data();
    const [auctionSnap, buyerSnap, disputeSnap] = await Promise.all([
      db.collection('auctions').doc(tx.auctionId).get(),
      db.collection('users').doc(tx.buyerId).get(),
      db.collection('disputes').where('transactionId', '==', doc.id).limit(1).get(),
    ]);

    const auction = auctionSnap.data() ?? {};
    const sellerSnap = auction.sellerId
      ? await db.collection('users').doc(auction.sellerId as string).get()
      : null;

    return {
      ...tx,
      id: doc.id,
      createdAt: readDate(tx.createdAt) ?? new Date(),
      updatedAt: readDate(tx.updatedAt) ?? new Date(),
      auction: {
        id: auctionSnap.id,
        title: (auction.title as string) ?? '',
        seller: {
          name: (sellerSnap?.data()?.name as string | null) ?? null,
          phone: (sellerSnap?.data()?.phone as string | null) ?? null,
        },
      },
      buyer: {
        name: (buyerSnap.data()?.name as string | null) ?? null,
        phone: (buyerSnap.data()?.phone as string | null) ?? null,
      },
      dispute: disputeSnap.empty ? null : {
        ...disputeSnap.docs[0].data(),
        id: disputeSnap.docs[0].id,
      },
    };
  }));
}

export async function resolveAdminDispute(transactionId: string, resolution: 'RELEASE' | 'REFUND') {
  await requireAdmin();

  const txRef = db.collection('escrowTransactions').doc(transactionId);
  const txSnap = await txRef.get();
  if (!txSnap.exists) throw new Error('Transaction not found');

  const tx = txSnap.data()!;
  const auctionRef = db.collection('auctions').doc(tx.auctionId);
  const auctionSnap = await auctionRef.get();
  if (!auctionSnap.exists) throw new Error('Auction not found');

  const auction = auctionSnap.data()!;
  const disputeSnap = await db.collection('disputes')
    .where('transactionId', '==', transactionId)
    .limit(1)
    .get();

  const batch = db.batch();

  if (resolution === 'RELEASE') {
    batch.update(txRef, { status: 'RELEASED', updatedAt: new Date() });
    batch.update(auctionRef, { deliveryStatus: 'DELIVERED', updatedAt: new Date() });
    batch.update(db.collection('users').doc(auction.sellerId), {
      reputationScore: FieldValue.increment(5),
      updatedAt: new Date(),
    });
    if (!disputeSnap.empty) {
      batch.update(disputeSnap.docs[0].ref, {
        status: 'RESOLVED_SELLER',
        resolution: 'Admin released funds to seller.',
        updatedAt: new Date(),
      });
    }
  } else {
    batch.update(txRef, { status: 'REFUNDED', updatedAt: new Date() });
    batch.update(db.collection('users').doc(tx.buyerId), {
      reputationScore: FieldValue.increment(2),
      updatedAt: new Date(),
    });
    batch.update(db.collection('users').doc(auction.sellerId), {
      reputationScore: FieldValue.increment(-10),
      updatedAt: new Date(),
    });
    if (!disputeSnap.empty) {
      batch.update(disputeSnap.docs[0].ref, {
        status: 'RESOLVED_BUYER',
        resolution: 'Admin refunded the buyer.',
        updatedAt: new Date(),
      });
    }
  }

  await batch.commit();
  return { success: true };
}

export async function getTreasuryAudit() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const filtered = txSnap.docs.filter((doc) => {
    const data = doc.data();
    return data.verificationType === 'AUTOMATIC' || Boolean(data.providerRef);
  });

  const auctionSnaps = await Promise.all(
    filtered.map((doc) => db.collection('auctions').doc(doc.data().auctionId as string).get())
  );
  const buyerSnaps = await Promise.all(
    filtered.map((doc) => db.collection('users').doc(doc.data().buyerId as string).get())
  );

  return filtered.slice(0, 50).map((doc, index) => ({
    ...doc.data(),
    id: doc.id,
    createdAt: readDate(doc.data().createdAt) ?? new Date(),
    updatedAt: readDate(doc.data().updatedAt) ?? new Date(),
    auction: {
      id: auctionSnaps[index]?.id,
      title: (auctionSnaps[index]?.data()?.title as string | undefined) ?? '',
    },
    buyer: {
      name: (buyerSnaps[index]?.data()?.name as string | null) ?? null,
      email: (buyerSnaps[index]?.data()?.email as string | null) ?? null,
    },
  }));
}
