'use server';

import { db, snapDocs } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { AuctionStatus, type User } from '@/types';
import { recalculateUserReputation } from '@/lib/reputation';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

/**
 * Admin Dashboard Core Stats
 * Optimized with Firestore aggregations to minimize billing and data transfer.
 */
export async function getAdminStats() {
  await requireAdmin();

  // 1. Efficient counts using aggregation (bills only 1 read per 1000 docs)
  const [userCountSnap, activeAuctionCountSnap, totalAuctionCountSnap, bidCountSnap, verifiedUserCountSnap] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('auctions').where('status', '==', AuctionStatus.ACTIVE).count().get(),
    db.collection('auctions').count().get(),
    db.collection('bids').count().get(),
    db.collection('users').where('isPhoneVerified', '==', true).count().get(),
  ]);

  // 2. Fetch only the data we need for the UI (recent users)
  const recentUsersSnap = await db.collection('users')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const recentUsers = snapDocs<User>(recentUsersSnap).map((user) => ({
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    isPhoneVerified: Boolean(user.isPhoneVerified),
    isVerifiedSeller: Boolean(user.isVerifiedSeller),
    reputationScore: Number(user.reputationScore ?? 0),
    createdAt: user.createdAt,
  }));

  // 3. Revenue calculation: Use the aggregated stats document (O(1) read)
  // instead of scanning all SOLD auctions (O(N) read).
  const statsSnap = await db.collection('stats').doc('global').get();
  const totalRevenue = Number(statsSnap.data()?.totalRevenue ?? 0);

  try {
    const stats = {
      totalUsers: userCountSnap.data().count,
      verifiedUsers: verifiedUserCountSnap.data().count,
      totalAuctions: totalAuctionCountSnap.data().count,
      activeAuctions: activeAuctionCountSnap.data().count,
      totalBids: bidCountSnap.data().count,
      totalRevenue,
      recentUsers,
    };
    return successResponse(stats);
  } catch (e) {
    log.error('[admin] getAdminStats failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch admin stats');
  }
}

/**
 * Toggle a user's verified-seller flag from the admin user table.
 * Used by VerificationToggle.tsx — flips current state and writes an audit
 * row so we keep a trail of who promoted whom.
 */
export async function adminToggleVerification(userId: string) {
  const session = await requireAdmin();

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');

  const current = Boolean(userSnap.data()?.isVerifiedSeller);
  const next = !current;
  const now = new Date();

  await userRef.update({ isVerifiedSeller: next, updatedAt: now });
  await db.collection('admin_logs').add({
    adminId: session.user.id,
    action: next ? 'GRANT_VERIFIED_SELLER' : 'REVOKE_VERIFIED_SELLER',
    targetId: userId,
    details: { previous: current, next },
    createdAt: now,
  });

  revalidatePath('/admin');
  return successResponse({ isVerifiedSeller: next });
}

// ─── Disputes & Treasury ────────────────────────────────────────────────────
//
// Admin-only readers + a unified RELEASE/REFUND resolver. Hydration here is
// intentionally per-row (small N, dispute counts measured in dozens not
// thousands). If counts grow, batch-fetch users/auctions like UsersTab does.

interface AdminEscrowDoc {
  id: string;
  auctionId: string;
  buyerId: string;
  amount: number;
  status: string;
  createdAt: FirebaseFirestore.Timestamp | Date;
  verificationType?: string | null;
  providerRef?: string | null;
}

type HydratedEscrowRow = {
  id: string; amount: number; status: string; createdAt: Date;
  verificationType: string; providerRef: string | null;
  auction: { id: string; title: string; seller: { name: string | null; phone: string | null } };
  buyer: { name: string | null; email: string | null; phone: string | null };
};

/**
 * Batch-hydrates an array of escrow docs in 3 round-trips (auctions+buyers,
 * then sellers) instead of N×3 serial reads per row.
 */
async function batchHydrateEscrowRows(txDocs: AdminEscrowDoc[]): Promise<HydratedEscrowRow[]> {
  if (txDocs.length === 0) return [];

  const auctionIds = [...new Set(txDocs.map((t) => t.auctionId))];
  const buyerIds   = [...new Set(txDocs.map((t) => t.buyerId))];

  const [auctionSnaps, buyerSnaps] = await Promise.all([
    db.getAll(...auctionIds.map((id) => db.collection('auctions').doc(id))),
    db.getAll(...buyerIds.map((id) => db.collection('users').doc(id))),
  ]);

  const auctionMap = new Map(auctionSnaps.map((s) => [s.id, s.data() ?? {}]));
  const buyerMap   = new Map(buyerSnaps.map((s) => [s.id, s.data() ?? {}]));

  const sellerIds = [
    ...new Set(
      auctionSnaps
        .map((s) => (s.data() ?? {}).sellerId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const sellerMap = new Map<string, FirebaseFirestore.DocumentData>();
  if (sellerIds.length > 0) {
    const sellerSnaps = await db.getAll(...sellerIds.map((id) => db.collection('users').doc(id)));
    sellerSnaps.forEach((s) => sellerMap.set(s.id, s.data() ?? {}));
  }

  return txDocs.map((tx) => {
    const auction = auctionMap.get(tx.auctionId) ?? {};
    const buyer   = buyerMap.get(tx.buyerId) ?? {};
    const seller  = auction.sellerId ? (sellerMap.get(auction.sellerId as string) ?? {}) : {};

    const createdAtRaw = tx.createdAt as unknown as { toDate?: () => Date } | Date;
    const createdAt = createdAtRaw instanceof Date ? createdAtRaw : createdAtRaw?.toDate?.() ?? new Date();

    return {
      id: tx.id,
      amount: tx.amount,
      status: tx.status,
      createdAt,
      verificationType: tx.verificationType ?? 'AUTOMATIC',
      providerRef: tx.providerRef ?? null,
      auction: {
        id:     tx.auctionId,
        title:  (auction.title  as string | null) ?? 'Unknown Auction',
        seller: { name: (seller.name  as string | null) ?? null, phone: (seller.phone as string | null) ?? null },
      },
      buyer: { name: (buyer.name as string | null) ?? null, email: (buyer.email as string | null) ?? null, phone: (buyer.phone as string | null) ?? null },
    };
  });
}

/**
 * All escrow transactions in DISPUTED state, with attached dispute reason.
 * UI: src/app/[locale]/admin/tabs/DisputesTab.tsx
 */
export async function getAdminDisputes() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', '==', 'DISPUTED')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  // Batch-hydrate rows and fetch dispute reasons in parallel.
  // Dispute lookups are per-transaction WHERE queries (can't batch), but
  // running them concurrently with batchHydrateEscrowRows keeps total round-trips at 4.
  const [hydratedRows, disputeSnaps] = await Promise.all([
    batchHydrateEscrowRows(txDocs),
    Promise.all(
      txDocs.map((tx) =>
        db.collection('disputes').where('transactionId', '==', tx.id).limit(1).get(),
      ),
    ),
  ]);

  try {
    const data = hydratedRows.map((row, i) => ({
      ...row,
      dispute: disputeSnaps[i].empty
        ? null
        : { reason: (disputeSnaps[i].docs[0].data().reason as string) ?? '' },
    }));
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getAdminDisputes failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch disputes');
  }
}

/**
 * Force-resolve a held/disputed escrow. Used by both DisputesTab and
 * TreasuryTab's manual override controls. Atomic: updates escrow + any
 * associated dispute doc together, then recalculates reputation.
 */
export async function resolveAdminDispute(transactionId: string, resolution: 'RELEASE' | 'REFUND') {
  await requireAdmin();

  try {
    const result = await db.runTransaction(async (tx) => {
      const txRef = db.collection('escrowTransactions').doc(transactionId);
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const t = txSnap.data()!;

      if (!['HELD', 'DISPUTED'].includes(t.status)) {
        throw new Error(`Cannot resolve escrow in ${t.status} state`);
      }

      const finalEscrow = resolution === 'RELEASE' ? 'RELEASED' : 'REFUNDED';
      const now = new Date();
      tx.update(txRef, { status: finalEscrow, updatedAt: now });

      // Pull seller before any writes that need it
      const aSnap = await tx.get(db.collection('auctions').doc(t.auctionId));
      const sellerId = aSnap.data()?.sellerId ?? null;

      // If a dispute doc exists for this tx, close it in the same transaction
      const disputeSnap = await db.collection('disputes')
        .where('transactionId', '==', transactionId)
        .where('status', '==', 'OPEN')
        .limit(1).get();
      if (!disputeSnap.empty) {
        const dRef = disputeSnap.docs[0].ref;
        tx.update(dRef, {
          status: resolution === 'RELEASE' ? 'RESOLVED_SELLER' : 'RESOLVED_BUYER',
          resolution: `Admin override: ${resolution}`,
          updatedAt: now,
        });
      }

      // If we refunded, cancel the auction so it isn't shown as a successful sale
      if (resolution === 'REFUND') {
        tx.update(db.collection('auctions').doc(t.auctionId), { status: 'CANCELLED', updatedAt: now });
      }

      return { sellerId, buyerId: t.buyerId };
    });

    if (result.sellerId) await recalculateUserReputation(result.sellerId);
    await recalculateUserReputation(result.buyerId);

    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    log.error('resolveAdminDispute failed', e, { transactionId, resolution });
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Resolution failed');
  }
}

/**
 * Read the buyer/seller coordination chat for an auction (admin view).
 * conversation doc id == auctionId by convention (see src/actions/escrow.ts
 * and src/actions/chat.ts).
 */
export async function getAdminCoordinationLog(auctionId: string) {
  await requireAdmin();

  const messagesSnap = await db.collection('messages')
    .where('conversationId', '==', auctionId)
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();

  try {
    const data = messagesSnap.docs.map((d) => {
      const data = d.data();
      const createdAtRaw = data.createdAt as { toDate?: () => Date } | Date;
      const createdAt = createdAtRaw instanceof Date ? createdAtRaw : createdAtRaw?.toDate?.() ?? new Date();
      return {
        id: d.id,
        content: (data.content as string) ?? '',
        senderId: (data.senderId as string) ?? 'system',
        isSystemMessage: Boolean(data.isSystemMessage),
        createdAt,
        imageUrl: (data.imageUrl as string | null) ?? null,
      };
    });
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getAdminCoordinationLog failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch coordination log');
  }
}

/**
 * Recent automated escrow transactions for the treasury audit table.
 * Filters to states where money has actually moved (HELD / RELEASED).
 */
export async function getTreasuryAudit() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', 'in', ['HELD', 'RELEASED'])
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getTreasuryAudit failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch treasury audit');
  }
}

/**
 * Currently HELD escrows — surfaced in TreasuryTab for admin manual override.
 */
export async function getAdminActiveEscrows() {
  await requireAdmin();

  const txSnap = await db.collection('escrowTransactions')
    .where('status', '==', 'HELD')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const txDocs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminEscrowDoc));

  try {
    const data = await batchHydrateEscrowRows(txDocs);
    return successResponse(data);
  } catch (e) {
    log.error('[admin] getAdminActiveEscrows failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch active escrows');
  }
}
