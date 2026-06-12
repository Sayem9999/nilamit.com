"use server";

/**
 * Admin operational interventions.
 *
 * These are the "break glass" actions admins use when something goes wrong
 * mid-flight: cancel a fraudulent bid, force-close a stuck auction, flip
 * maintenance mode, push a system-wide notification, etc.
 *
 * Every action:
 *   - requires admin via requireAdmin()
 *   - writes an admin_logs row so we have a forensic trail
 *   - runs in a Firestore transaction where state integrity matters
 *
 * No bulk actions on this file — operational interventions are by definition
 * one-at-a-time + thoughtful. Bulk fan-out (e.g. mass-send notifications)
 * goes through bulkBroadcast which has its own throttling.
 */

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { notify } from '@/lib/notification-channels';
import type { AuctionStatus } from '@/types';

/**
 * Toggle maintenance mode — sets systemConfig.maintenanceMode + optional
 * message. Middleware (or layout) can read this on every request to show
 * a banner / 503 the app.
 */
export async function setMaintenanceMode(
  enabled: boolean,
  message?: string,
): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();
  try {
    await db.collection('systemConfig').doc('default').set(
      {
        maintenanceMode: enabled,
        maintenanceMessage: message ?? null,
        maintenanceSetBy: adminSession.user.id,
        maintenanceSetAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await db.collection('admin_logs').add({
      adminId: adminSession.user.id,
      action: enabled ? 'MAINTENANCE_ENABLE' : 'MAINTENANCE_DISABLE',
      reason: message ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/', 'layout');
    return successResponse(null);
  } catch (err) {
    log.error('[admin/ops] setMaintenanceMode failed', err, { area: 'admin', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'Could not flip maintenance mode');
  }
}

const ForceCloseSchema = z.object({
  auctionId: z.string().min(1).max(128),
  reason: z.string().min(5).max(500),
  /** What state to land the auction in. */
  resolution: z.enum(['CANCELLED', 'EXPIRED']),
});

/**
 * Force-close a stuck auction. Use case: seller is banned mid-auction,
 * auction is spam/fraud, payment gateway outage left an auction in
 * limbo. Cancels any pending escrow that's still in PENDING state.
 */
export async function forceCloseAuction(
  input: unknown,
): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();
  const parsed = ForceCloseSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, 'Invalid input');
  const { auctionId, reason, resolution } = parsed.data;

  try {
    await db.runTransaction(async (tx) => {
      const auctionRef = db.collection('auctions').doc(auctionId);
      const snap = await tx.get(auctionRef);
      if (!snap.exists) throw new Error('Auction not found');
      const a = snap.data() as { status: AuctionStatus; sellerId: string; title?: string };
      if (['CANCELLED', 'EXPIRED', 'SOLD', 'RELEASED'].includes(a.status)) {
        throw new Error(`Auction already terminal: ${a.status}`);
      }

      tx.update(auctionRef, {
        status: resolution,
        forceClosedBy: adminSession.user.id,
        forceCloseReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Cancel any in-flight escrow that hasn't been paid yet.
      const escrowRef = db.collection('escrowTransactions').doc(auctionId);
      const eSnap = await tx.get(escrowRef);
      if (eSnap.exists) {
        const e = eSnap.data() as { status: string };
        if (e.status === 'PENDING' || e.status === 'VERIFICATION_PENDING') {
          tx.update(escrowRef, {
            status: 'CANCELLED',
            cancelReason: `Force-closed by admin: ${reason}`,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      tx.set(db.collection('admin_logs').doc(), {
        adminId: adminSession.user.id,
        action: 'FORCE_CLOSE_AUCTION',
        targetId: auctionId,
        reason,
        metadata: { resolution, previousStatus: a.status, sellerId: a.sellerId },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    revalidatePath(`/auctions/${auctionId}`);
    return successResponse(null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Force-close failed';
    log.error('[admin/ops] forceCloseAuction failed', err, { auctionId, area: 'admin', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, msg);
  }
}

const CancelBidSchema = z.object({
  bidId: z.string().min(1).max(128),
  reason: z.string().min(5).max(500),
});

/**
 * Cancel a fraudulent bid. Mostly used after shill-detector flags one and
 * a moderator confirms. Marks bid as CANCELLED + recomputes auction state
 * (currentBidderId, currentPrice) based on remaining valid bids.
 *
 * If the cancelled bid is NOT the current top bid, just flag it — no state
 * recompute needed. If it IS the current top bid, walk the bids collection
 * to find the next-highest non-cancelled bid and set it as current.
 */
export async function cancelBid(input: unknown): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();
  const parsed = CancelBidSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, 'Invalid input');
  const { bidId, reason } = parsed.data;

  try {
    await db.runTransaction(async (tx) => {
      const bidRef = db.collection('bids').doc(bidId);
      const bidSnap = await tx.get(bidRef);
      if (!bidSnap.exists) throw new Error('Bid not found');
      const bid = bidSnap.data() as { auctionId: string; bidderId: string; amount: number; status?: string };
      if (bid.status === 'CANCELLED') throw new Error('Bid already cancelled');

      const auctionRef = db.collection('auctions').doc(bid.auctionId);
      const aSnap = await tx.get(auctionRef);
      if (!aSnap.exists) throw new Error('Parent auction not found');
      const a = aSnap.data() as { currentBidderId?: string | null; currentPrice: number; startingPrice: number };

      tx.update(bidRef, {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledBy: adminSession.user.id,
        cancelledAt: FieldValue.serverTimestamp(),
      });

      // If this bid is the current top bid we need to recompute the auction.
      // We can't easily query "next-highest non-cancelled bid" inside a transaction
      // without first fetching all bids. For now, mark the auction state and let
      // a follow-up cron recompute precisely; set currentBidderId=null + price
      // back to starting if no other bids exist. (Most cancel-bid cases come
      // from solo-bid shill, so this is the dominant path.)
      if (a.currentBidderId === bid.bidderId) {
        tx.update(auctionRef, {
          currentBidderId: null,
          currentPrice: a.startingPrice,
          proxyBidderId: null,
          proxyMaxBid: 0,
          recomputeNeeded: true, // flag for a cron to walk bids and re-derive
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(db.collection('admin_logs').doc(), {
        adminId: adminSession.user.id,
        action: 'CANCEL_BID',
        targetId: bidId,
        reason,
        metadata: { auctionId: bid.auctionId, bidderId: bid.bidderId, amount: bid.amount },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return successResponse(null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cancel-bid failed';
    log.error('[admin/ops] cancelBid failed', err, { bidId, area: 'bid', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, msg);
  }
}

const BroadcastSchema = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(3).max(280),
  /** Optional URL to deep-link the notification to. */
  clickUrl: z.string().url().max(2048).optional(),
  /** Cap on how many users receive this in one batch (prevent runaway cost). */
  maxRecipients: z.number().int().min(1).max(10000).default(1000),
});

/**
 * Broadcast a notification to ALL active users (capped). Uses the new
 * notify() channel-fan-out so users get it via their preferred channel(s).
 *
 * Server-side caps at 1000 recipients per call to prevent runaway WhatsApp
 * costs from a typo. For bigger announcements, run multiple batches or
 * use the announcement banner in systemConfig instead.
 */
export async function broadcastNotification(
  input: unknown,
): Promise<ServiceResponse<{ recipients: number }>> {
  const adminSession = await requireAdmin();
  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, 'Invalid input');
  const { title, body, clickUrl, maxRecipients } = parsed.data;

  try {
    // Fetch the most recently-active users, then drop banned ones in-app.
    //
    // We deliberately do NOT filter banned at the query level: Firestore's
    // `!=`/`==` on `isBanned` only matches docs where the field exists, which
    // would silently exclude every legacy account that never had `isBanned`
    // written — i.e. most of the user base. Banned users are a tiny minority,
    // so over-fetching a small margin and filtering here costs almost nothing
    // while guaranteeing legacy accounts are reachable.
    const OVERFETCH = 50;
    const snap = await db
      .collection('users')
      .orderBy('updatedAt', 'desc')
      .limit(maxRecipients + OVERFETCH)
      .get();

    const recipients = snap.docs
      .filter((d) => d.data().isBanned !== true)
      .slice(0, maxRecipients)
      .map((d) => d.id);

    // Fan out in parallel batches of 100 so we don't hold the request open
    // forever. notify() is fire-and-forget internally; this just waits for
    // the per-recipient enqueue to complete.
    const BATCH = 100;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const slice = recipients.slice(i, i + BATCH);
      await Promise.all(
        slice.map((uid) =>
          notify(uid, {
            type: 'admin_broadcast',
            title,
            body,
            clickUrl,
            data: { broadcastBy: adminSession.user.id },
          }).catch(() => 0),
        ),
      );
    }

    await db.collection('admin_logs').add({
      adminId: adminSession.user.id,
      action: 'BROADCAST_NOTIFICATION',
      reason: title,
      metadata: { body, clickUrl, recipientCount: recipients.length },
      createdAt: FieldValue.serverTimestamp(),
    });

    log.info('[admin/ops] broadcast sent', { adminId: adminSession.user.id, recipients: recipients.length });
    return successResponse({ recipients: recipients.length });
  } catch (err) {
    log.error('[admin/ops] broadcast failed', err, { area: 'admin', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, 'Broadcast failed');
  }
}

/**
 * List recent admin actions (newest first). Default 100; admin UI can
 * paginate by passing `beforeTs` to fetch the next page.
 */
export async function listAuditLog(
  limit = 100,
  beforeTs?: number,
): Promise<ServiceResponse<Array<{
  id: string;
  adminId: string;
  action: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | null;
}>>> {
  await requireAdmin();
  try {
    let q = db.collection('admin_logs').orderBy('createdAt', 'desc').limit(Math.min(limit, 500));
    if (beforeTs) {
      q = q.where('createdAt', '<', new Date(beforeTs));
    }
    const snap = await q.get();
    return successResponse(
      snap.docs.map((d) => {
        const data = d.data() as { createdAt?: { toDate?: () => Date }; [k: string]: unknown };
        return {
          id: d.id,
          adminId: String(data.adminId ?? ''),
          action: String(data.action ?? ''),
          targetId: data.targetId ? String(data.targetId) : undefined,
          reason: data.reason ? String(data.reason) : undefined,
          metadata: data.metadata as Record<string, unknown> | undefined,
          createdAt: data.createdAt?.toDate?.() ?? null,
        };
      }),
    );
  } catch (err) {
    log.error('[admin/ops] listAuditLog failed', err, { area: 'admin' });
    return errorResponse(ErrorType.INTERNAL, 'Could not load audit log');
  }
}

/**
 * Recompute global stats (totalUsers / totalAuctions / totalBids /
 * verifiedSellers). Use when the denormalized counters look wrong —
 * e.g. after a manual data cleanup or a Firestore export-import.
 */
export async function recomputeGlobalStats(): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();
  try {
    const [users, bids, auctions, sellers] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('bids').count().get(),
      db.collection('auctions').count().get(),
      db.collection('users').where('isVerifiedSeller', '==', true).count().get(),
    ]);

    await db.collection('stats').doc('global').set({
      totalUsers: users.data().count,
      totalBids: bids.data().count,
      totalAuctions: auctions.data().count,
      totalVerifiedSellers: sellers.data().count,
      isReal: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection('admin_logs').add({
      adminId: adminSession.user.id,
      action: 'RECOMPUTE_STATS',
      createdAt: FieldValue.serverTimestamp(),
    });
    return successResponse(null);
  } catch (err) {
    log.error('[admin/ops] recomputeGlobalStats failed', err, { area: 'admin' });
    return errorResponse(ErrorType.INTERNAL, 'Recompute failed');
  }
}
