'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

export async function getAdminReports(status?: string) {
  await requireAdmin();

  let query: FirebaseFirestore.Query = db.collection('reports');
  if (status) {
    query = query.where('status', '==', status);
  }
  
  const snap = await query.orderBy('createdAt', 'desc').limit(100).get();

  const reports = await Promise.all(snap.docs.map(async d => {
    const r = d.data();
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

  return { success: true, reports: reports.filter(Boolean) };
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
