'use server';

import { db, snapDocs, FieldValue } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath } from 'next/cache';
import { Auction, User, Report } from '@/types';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

export async function getAdminReports(status?: string, page = 1, limit = 20) {
  try {
    await requireAdmin();

    let query: FirebaseFirestore.Query = db.collection('reports');
    if (status) query = query.where('status', '==', status);
    
    const totalSnap = await query.count().get();
    const total = totalSnap.data().count;

    const snap = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .get();

    const reportDocs = snapDocs<Report>(snap);
    if (reportDocs.length === 0) {
      return successResponse({ reports: [], total, pages: 0 });
    }

    // 1. Batch fetch primary related entities
    const auctionIds  = [...new Set(reportDocs.map(r => r.auctionId))];
    const reporterIds = [...new Set(reportDocs.map(r => r.reporterId))];

    const [aSnaps, uSnaps] = await Promise.all([
      Promise.all(auctionIds.map(id => db.collection('auctions').doc(id).get())),
      Promise.all(reporterIds.map(id => db.collection('users').doc(id).get()))
    ]);

    const aMap = new Map(aSnaps.map(s => [s.id, s.data() || {}]));
    const uMap = new Map(uSnaps.map(s => [s.id, s.data() || {}]));

    // 2. Fetch Sellers (second-degree batch)
    const sellerIds = [...new Set(aSnaps.map(s => s.data()?.sellerId).filter(Boolean))];
    const sSnaps    = await Promise.all(sellerIds.map(id => db.collection('users').doc(id).get()));
    const sMap      = new Map(sSnaps.map(s => [s.id, s.data() || {}]));

    const reports = reportDocs.map(r => {
      const auction  = aMap.get(r.auctionId) || {};
      const reporter = uMap.get(r.reporterId) || {};
      const seller   = sMap.get(auction.sellerId) || {};

      return {
        ...r,
        auction: {
          id: r.auctionId,
          title: auction.title ?? 'Deleted Auction',
          status: auction.status,
          images: auction.images || [],
          seller: { name: seller.name || 'Unknown', email: seller.email || '' }
        },
        reporter: {
          id: r.reporterId,
          name: reporter.name || 'Anonymous',
          email: reporter.email || '',
          image: reporter.image || null
        }
      };
    });

    return successResponse({ reports, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch reports');
  }
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
  try {
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

    return successResponse({ auctions, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch auctions');
  }
}

export async function resolveReport(reportId: string, status: string) {
  try {
    const session = await requireAdmin();
    await db.collection('reports').doc(reportId).update({
      status, updatedAt: new Date(),
    });

    // Audit Log
    await db.collection('admin_logs').add({
      adminId: session.user.id,
      action: 'RESOLVE_REPORT',
      targetId: reportId,
      details: { status },
      createdAt: new Date()
    });

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to resolve report');
  }
}

export async function suspendAuction(auctionId: string, reportId: string, reason: string) {
  try {
    const session = await requireAdmin();

    const batch = db.batch();
    const aRef = db.collection('auctions').doc(auctionId);
    const aSnap = await aRef.get();
    const auctionData = aSnap.data();

    batch.update(aRef, {
      status: 'CANCELLED', updatedAt: new Date(),
    });

    if (auctionData?.sellerId) {
      batch.update(db.collection('users').doc(auctionData.sellerId), {
        defectCount: FieldValue.increment(1),
        updatedAt: new Date(),
      });
    }

    if (reportId) {
      batch.update(db.collection('reports').doc(reportId), {
        status: 'RESOLVED', updatedAt: new Date(),
      });
    }

    // Mandatory Audit Log
    const logRef = db.collection('admin_logs').doc();
    batch.set(logRef, {
      adminId: session.user.id,
      action: 'SUSPEND_AUCTION',
      targetId: auctionId,
      details: { reportId, reason },
      createdAt: new Date()
    });

    await batch.commit();

    if (auctionData?.sellerId) {
      await updateSellerPerformance(auctionData.sellerId);
    }

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    return errorResponse(ErrorType.INTERNAL, 'Failed to suspend auction');
  }
}
