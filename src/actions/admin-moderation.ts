'use server';

import { db, snapDocs } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { Auction, User } from '@/types';

export async function getAdminReports(status?: string, page = 1, limit = 20) {
  await requireAdmin();

  let query: FirebaseFirestore.Query = db.collection('reports');
  if (status) {
    query = query.where('status', '==', status);
  }
  
  const totalSnap = await query.count().get();
  const total = totalSnap.data().count;

  const snap = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset((page - 1) * limit)
    .get();

  const reports = await Promise.all(snap.docs.map(async d => {
    const r = d.data();
    // Targeted lookups
    const [aSnap, reporterSnap] = await Promise.all([
      db.collection('auctions').doc(r.auctionId).get(),
      db.collection('users').doc(r.reporterId).get(),
    ]);

    if (!aSnap.exists) return null;

    const auctionData = aSnap.data()!;
    const sellerSnap = await db.collection('users').doc(auctionData.sellerId).get();
    const sellerData = sellerSnap.data() || {};

    return {
      id: d.id,
      reason: r.reason,
      description: r.description || null,
      status: r.status,
      createdAt: r.createdAt?.toDate?.() ?? new Date(r.createdAt),
      updatedAt: r.updatedAt?.toDate?.() ?? new Date(r.updatedAt),
      auction: {
        id: aSnap.id,
        title: auctionData.title ?? 'Deleted Auction',
        status: auctionData.status,
        images: auctionData.images || [],
        seller: {
          name: sellerData.name || 'Unknown',
          email: sellerData.email || '',
        }
      },
      reporter: {
        id: reporterSnap.id,
        name: reporterSnap.data()?.name || 'Anonymous',
        email: reporterSnap.data()?.email || '',
        image: reporterSnap.data()?.image || null,
      }
    };
  }));

  return { 
    success: true, 
    reports: reports.filter(Boolean), 
    total, 
    pages: Math.ceil(total / limit) 
  };
}

async function getUserMap(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const snaps = await Promise.all(uniqueIds.map((userId) => db.collection('users').doc(userId).get()));
  return new Map(
    snaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as User])
  );
}

export async function getAdminAuctions(page = 1, limit = 20, status?: string) {
  await requireAdmin();

  let query: FirebaseFirestore.Query = db.collection('auctions');
  if (status) {
    query = query.where('status', '==', status);
  }

  const totalSnap = await query.count().get();
  const total = totalSnap.data().count;

  const auctionsSnap = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset((page - 1) * limit)
    .get();

  const pagedAuctions = snapDocs<Auction>(auctionsSnap);
  
  const sellerIds = [...new Set(pagedAuctions.map(a => a.sellerId))];
  const sellerMap = await getUserMap(sellerIds);

  const auctions = pagedAuctions.map((auction) => ({
    ...auction,
    seller: {
      name: sellerMap.get(auction.sellerId)?.name ?? null,
      email: sellerMap.get(auction.sellerId)?.email ?? null,
    },
    _count: {
      bids: Number(auction.bidCount ?? 0),
    },
  }));

  return { success: true, auctions, total, pages: Math.ceil(total / limit) };
}

export async function resolveReport(reportId: string, status: string) {
  await requireAdmin();
  await db.collection('reports').doc(reportId).update({
    status, updatedAt: new Date(),
  });
  revalidatePath('/admin');
  return { success: true };
}

export async function suspendAuction(auctionId: string, reportId: string) {
  await requireAdmin();

  const batch = db.batch();
  batch.update(db.collection('auctions').doc(auctionId), {
    status: 'CANCELLED', updatedAt: new Date(),
  });
  if (reportId) {
    batch.update(db.collection('reports').doc(reportId), {
      status: 'RESOLVED', updatedAt: new Date(),
    });
  }
  await batch.commit();
  revalidatePath('/admin');
  return { success: true };
}
