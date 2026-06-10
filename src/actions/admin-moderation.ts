'use server';

import { db, snapDocs, FieldValue, batchDelete } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { revalidatePath, revalidateTag } from 'next/cache';
import { removeAuctionFromIndex, updateAuctionInIndex } from '@/lib/search-engine';
import { Auction, User, Report } from '@/types';
import { updateSellerPerformance } from '@/lib/seller-performance';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { adminDB } from '@/lib/firebase-admin';
import { RTDB_PATHS } from '@/lib/firebase-events';
import { log } from '@/lib/logger';
import { AuditService } from '@/services/admin/audit-service';

export async function getAdminReports(status?: string, page = 1, limit = 20): Promise<ServiceResponse<{ reports: unknown[], total: number, pages: number }>> {
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
      auctionIds.length > 0 ? db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id))) : Promise.resolve([]),
      reporterIds.length > 0 ? db.getAll(...reporterIds.map(id => db.collection('users').doc(id))) : Promise.resolve([])
    ]);

    const aMap = new Map(aSnaps.map(s => [s.id, s.data() || {}]));
    const uMap = new Map(uSnaps.map(s => [s.id, s.data() || {}]));

    // 2. Fetch Sellers (second-degree batch)
    const sellerIds = [...new Set(aSnaps.map(s => s.data()?.sellerId).filter(Boolean))];
    const sSnaps    = sellerIds.length > 0 ? await db.getAll(...sellerIds.map(id => db.collection('users').doc(id))) : [];
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
    log.error('[Action] getAdminReports failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch reports');
  }
}

async function getUserMap(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const snaps = uniqueIds.length > 0 ? await db.getAll(...uniqueIds.map((userId) => db.collection('users').doc(userId))) : [];
  return new Map(
    snaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as User])
  );
}

export async function getAdminAuctions(page = 1, limit = 20, status?: string): Promise<ServiceResponse<{ auctions: unknown[], total: number, pages: number }>> {
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
    log.error('[Action] getAdminAuctions failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch auctions');
  }
}

export async function resolveReport(reportId: string, status: string): Promise<ServiceResponse<null>> {
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
    log.error('[Action] resolveReport failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to resolve report');
  }
}

export async function suspendAuction(auctionId: string, reportId: string, reason: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();

    const batch = db.batch();
    const aRef = db.collection('auctions').doc(auctionId);
    const aSnap = await aRef.get();
    const auctionData = aSnap.data();

    const beforeState = auctionData || null;
    const updateData = {
      status: 'CANCELLED', updatedAt: new Date(),
    };
    const afterState = beforeState ? { ...beforeState, ...updateData } : null;

    batch.update(aRef, updateData);
    await AuditService.logAuctionChange(auctionId, beforeState, afterState, 'UPDATE', session.user.id, batch);

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

    // Same staleness class as takedown/delete: drop from ACTIVE search results
    // and clear the tag-cached home/listing rails.
    updateAuctionInIndex(auctionId, { status: 'CANCELLED' }).catch(() => {});
    revalidatePath('/admin');
    revalidateTag('auctions', { expire: 0 });
    return successResponse(null);
  } catch (e) {
    log.error('[Action] suspendAuction failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to suspend auction');
  }
}

export async function adminTakeDownAuction(auctionId: string, reason: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();

    const batch = db.batch();
    const aRef = db.collection('auctions').doc(auctionId);
    const aSnap = await aRef.get();
    if (!aSnap.exists) {
      return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    }
    const auctionData = aSnap.data();

    const beforeState = auctionData || null;
    const updateData = {
      status: 'CANCELLED',
      updatedAt: new Date(),
    };
    const afterState = beforeState ? { ...beforeState, ...updateData } : null;

    batch.update(aRef, updateData);
    await AuditService.logAuctionChange(auctionId, beforeState, afterState, 'UPDATE', session.user.id, batch);

    if (auctionData?.sellerId) {
      batch.update(db.collection('users').doc(auctionData.sellerId), {
        defectCount: FieldValue.increment(1),
        updatedAt: new Date(),
      });
    }

    // Mandatory Audit Log
    const logRef = db.collection('admin_logs').doc();
    batch.set(logRef, {
      adminId: session.user.id,
      action: 'TAKE_DOWN_AUCTION',
      targetId: auctionId,
      details: { reason },
      createdAt: new Date()
    });

    await batch.commit();

    if (auctionData?.sellerId) {
      await updateSellerPerformance(auctionData.sellerId);
    }

    // RTDB Cleanup
    try {
      await adminDB.ref(RTDB_PATHS.auctionBid(auctionId)).remove();
    } catch (e) {
      log.error('Failed to clean up RTDB bid on takedown', e);
    }

    // Drop it from ACTIVE search results (no-op until engine provisioned).
    updateAuctionInIndex(auctionId, { status: 'CANCELLED' }).catch(() => {});

    revalidatePath('/admin');
    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/');
    // revalidatePath does NOT clear unstable_cache tag entries — the homepage
    // feeds are tag-cached, so without this a taken-down auction can keep
    // appearing in home rails until the TTL lapses.
    revalidateTag('auctions', { expire: 0 });
    return successResponse(null);
  } catch (e) {
    log.error('[Action] adminTakeDownAuction failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to take down auction');
  }
}

export async function adminDeleteAuction(auctionId: string, reason: string): Promise<ServiceResponse<null>> {
  try {
    const session = await requireAdmin();

    const aRef = db.collection('auctions').doc(auctionId);
    const aSnap = await aRef.get();
    if (!aSnap.exists) {
      return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    }
    const auctionData = aSnap.data();

    // 1. Delete related entities in large batches (safe for >500 docs)
    await Promise.all([
      batchDelete(db.collection('bids').where('auctionId', '==', auctionId)),
      batchDelete(db.collection('reports').where('auctionId', '==', auctionId)),
      batchDelete(db.collection('watchlist').where('auctionId', '==', auctionId)),
      batchDelete(db.collection('conversations').where('auctionId', '==', auctionId)),
    ]);

    // 2. Delete the auction itself and log in a final atomic batch
    const batch = db.batch();
    batch.delete(aRef);
    await AuditService.logAuctionChange(auctionId, auctionData || null, null, 'DELETE', session.user.id, batch);

    // Mandatory Audit Log
    const logRef = db.collection('admin_logs').doc();
    batch.set(logRef, {
      adminId: session.user.id,
      action: 'DELETE_AUCTION',
      targetId: auctionId,
      details: { reason, title: auctionData?.title },
      createdAt: new Date()
    });

    await batch.commit();

    if (auctionData?.sellerId) {
      await updateSellerPerformance(auctionData.sellerId);
    }

    // RTDB Cleanups
    try {
      await Promise.all([
        adminDB.ref(RTDB_PATHS.auctionBid(auctionId)).remove(),
        adminDB.ref(RTDB_PATHS.auctionActivity(auctionId)).remove(),
      ]);
    } catch (e) {
      log.error('Failed to clean up RTDB on auction delete', e);
    }

    // Remove from the search index — this is the platform's only hard-delete
    // path, the gap called out in docs/SEARCH.md (no-op until provisioned).
    removeAuctionFromIndex(auctionId).catch(() => {});

    revalidatePath('/admin');
    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/');
    // Tag caches (homepage rails, listings) aren't cleared by revalidatePath —
    // without this, the cached home keeps linking to the deleted auction
    // (observed live in the June 2026 UX audit: hero rail → AUCTION NOT FOUND).
    revalidateTag('auctions', { expire: 0 });
    return successResponse(null);
  } catch (e) {
    log.error('[Action] adminDeleteAuction failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to permanently delete auction');
  }
}
