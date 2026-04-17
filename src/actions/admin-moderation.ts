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
  try {
    await requireAdmin();

    let query: FirebaseFirestore.Query = db.collection('reports').orderBy('createdAt', 'desc');
    if (status) query = query.where('status', '==', status);

    const snap = await query.limit(100).get();

    const reports = await Promise.all(snap.docs.map(async d => {
      const r = d.data();
      const [aSnap, reporterSnap] = await Promise.all([
        db.collection('auctions').doc(r.auctionId).get(),
        db.collection('users').doc(r.reporterId).get(),
      ]);
      return {
        ...r, id: d.id,
        createdAt: r.createdAt?.toDate?.() ?? new Date(r.createdAt),
        auction:  aSnap.exists  ? { id: aSnap.id, title: aSnap.data()?.title ?? '' } : null,
        reporter: reporterSnap.exists ? { id: reporterSnap.id, name: reporterSnap.data()?.name ?? '' } : null,
      } as any;
    }));

    return { success: true, reports };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed', reports: [] as any[] };
  }
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
