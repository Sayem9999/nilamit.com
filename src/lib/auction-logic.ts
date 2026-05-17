import 'server-only';
import { db, incrementGlobalStat } from '@/lib/db';
import { sendAuctionWonEmail } from '@/lib/firebase-email';
import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import type { AuctionStatus } from '@/types';
import { log } from '@/lib/logger';
import { scheduleEnforcePaymentPolicy } from '@/lib/cloud-tasks';

// ─── Commission Tiers ────────────────────────────────────────────────────────
export function calculateSuccessFee(finalPrice: number): { fee: number; rate: number } {
  if (finalPrice <= 10000)  return { fee: Math.round(finalPrice * 0.025) + 20, rate: 0.025 };
  if (finalPrice <= 150000) return { fee: Math.round(finalPrice * 0.015) + 20, rate: 0.015 };
  return { fee: Math.round(finalPrice * 0.01) + 20, rate: 0.01 };
}

// ─── Post-sale notification payload ─────────────────────────────────────────
interface SaleNotifyPayload {
  winnerId:    string;
  sellerId:    string;
  winnerEmail: string | null;
  auctionId:   string;
  title:       string;
  finalPrice:  number;
  // Carried out of the transaction so the caller can run side-effects
  // (revenue stat, gamification, email) AFTER commit — fixes double-counting
  // on transaction retries.
  fee:         number;
}

// ─── processAuctionSale ──────────────────────────────────────────────────────
/**
 * Called inside a Firestore transaction — writes auction + escrow updates only.
 * MUST NOT perform any side-effects (stat increments, RTDB writes, emails) —
 * Firestore retries the closure on contention and side-effects would multiply.
 *
 * Returns notification data; the CALLER is responsible for firing notifications
 * AFTER the transaction commits (see sendSaleNotifications).
 */
export function processAuctionSale(
  transaction: FirebaseFirestore.Transaction,
  auction: {
    id: string; title: string; sellerId: string;
    deliveryCharge?: number | null;
    reservePrice?: number | null;
  },
  seller: { id: string; isVerifiedSeller: boolean },
  winner: { id: string; email: string | null; name: string | null },
  finalPrice: number,
): SaleNotifyPayload {
  if (auction.reservePrice && finalPrice < auction.reservePrice) {
    throw new Error('Reserve price not met.');
  }

  const { fee, rate } = calculateSuccessFee(finalPrice);
  const now = new Date();

  const auctionRef = db.collection('auctions').doc(auction.id);
  transaction.update(auctionRef, {
    status:           'SOLD' as AuctionStatus,
    winnerId:         winner.id,
    commissionRate:   rate,
    commissionEarned: fee,
    updatedAt:        now,
  });

  // Always escrow the full final price regardless of seller verification status.
  // Commission is extracted on release (not on creation) so refunds remain whole.
  const deliveryCharge = auction.deliveryCharge ?? 0;
  const escrowAmount   = finalPrice + deliveryCharge;

  const escrowRef = db.collection('escrowTransactions').doc(auction.id);
  // set() without merge so a second call can never silently re-open a closed escrow.
  transaction.set(escrowRef, {
    id:               auction.id,
    auctionId:        auction.id,
    buyerId:          winner.id,
    sellerId:         auction.sellerId,
    amount:           escrowAmount,
    status:           'PENDING',
    paymentMethod:    null,
    providerRef:      null,
    verificationType: null,
    createdAt:        now,
    updatedAt:        now,
  });

  const convRef = db.collection('conversations').doc(auction.id);
  transaction.set(convRef, {
    id:                  auction.id,
    auctionId:           auction.id,
    buyerId:             winner.id,
    sellerId:            auction.sellerId,
    lastMessageAt:       now,
    lastMessageContent:  'Auction won. Tap here to start coordination!',
    lastMessageSenderId: 'system',
    createdAt:           now,
    updatedAt:           now,
  });

  return {
    winnerId:    winner.id,
    sellerId:    auction.sellerId,
    winnerEmail: winner.email,
    auctionId:   auction.id,
    title:       auction.title,
    finalPrice,
    fee,
  };
}

import { GamificationService } from '@/services/gamification/gamification-service';

// ─── sendSaleNotifications ───────────────────────────────────────────────────
/** Caller invokes this AFTER the auction-sale transaction commits. */
export function sendSaleNotifications(payload: SaleNotifyPayload) {
  // Revenue stat — moved out of the transaction body so retries don't double-count.
  incrementGlobalStat('totalRevenue', payload.fee).catch((e) =>
    log.error('auction-logic: revenue stat increment failed', e, { auctionId: payload.auctionId }),
  );

  if (payload.winnerEmail) {
    sendAuctionWonEmail(payload.winnerEmail, payload.title, payload.finalPrice, payload.auctionId)
      .catch((e) => log.error('auction-logic: winner email failed', e, { auctionId: payload.auctionId }));
  }
  rtdbPush(RTDB_PATHS.userNotifications(payload.winnerId), {
    event:     FIREBASE_EVENTS.AUCTION_WON,
    auctionId: payload.auctionId,
    title:     payload.title,
    amount:    payload.finalPrice,
  }).catch((e) => log.error('auction-logic: winner RTDB notification failed', e, { auctionId: payload.auctionId }));

  GamificationService.processSaleGamification(payload.winnerId, payload.sellerId).catch((e) =>
    log.error('auction-logic: sale gamification failed', e, { auctionId: payload.auctionId }),
  );

  // Sync status to RTDB for real-time UI updates
  rtdbSet(RTDB_PATHS.auctionStatus(payload.auctionId), {
    type: FIREBASE_EVENTS.AUCTION_SOLD,
    amount: payload.finalPrice,
    status: 'SOLD',
    updatedAt: new Date().toISOString(),
  }).catch((e: unknown) => log.error('auction-logic: RTDB status sync failed', e, { auctionId: payload.auctionId }));

  // Schedule enforcement of 24h payment policy
  scheduleEnforcePaymentPolicy(payload.auctionId).catch((e) =>
    log.error('auction-logic: enforce payment task scheduling failed', e, { auctionId: payload.auctionId })
  );
}

// ─── closeAuctionIfEnded ─────────────────────────────────────────────────────
function coerceEndTime(raw: unknown): Date | null {
  if (!raw) return null;
  const d = (raw as { toDate?: () => Date })?.toDate
    ? (raw as { toDate: () => Date }).toDate()
    : new Date(raw as string | number | Date);
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return d;
}

export async function closeAuctionIfEnded(auctionId: string): Promise<void> {
  try {
    const notifyPayload = await db.runTransaction(async (tx) => {
      const aRef  = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) return null;

      const a = aSnap.data()!;
      if (a.status !== 'ACTIVE') return null;

      const now     = new Date();
      const endTime = coerceEndTime(a.endTime);
      if (!endTime) {
        // Malformed auction — mark expired so it stops being picked up by cron.
        tx.update(aRef, { status: 'EXPIRED', updatedAt: now });
        return null;
      }
      if (now < endTime) return null;

      // Winner is denormalised onto the auction doc — transactionally safe;
      // a collection query here would not be locked and could race late bids.
      const winnerId:    string | null = a.currentBidderId ?? null;
      const finalPrice:  number | null = a.currentPrice    ?? null;

      if (!winnerId || !finalPrice) {
        tx.update(aRef, { status: 'EXPIRED', updatedAt: now });
        
        // Notify RTDB of expiry (fire and forget after tx commit if possible, but here we are in tx)
        // We'll do it after the transaction to be safe.
        return { expired: true, auctionId };
      }

      const [winnerSnap, sellerSnap] = await Promise.all([
        tx.get(db.collection('users').doc(winnerId)),
        tx.get(db.collection('users').doc(a.sellerId)),
      ]);

      const winnerData = winnerSnap.data() || {};
      const sellerData = sellerSnap.data() || {};

      return processAuctionSale(
        tx,
        { id: auctionId, title: a.title, sellerId: a.sellerId,
          deliveryCharge: a.deliveryCharge, reservePrice: a.reservePrice },
        { id: a.sellerId, isVerifiedSeller: sellerData.isVerifiedSeller ?? false },
        { id: winnerId, email: winnerData.email ?? null, name: winnerData.name ?? 'Winner' },
        finalPrice,
      );
    });

    if (notifyPayload) {
      if ('expired' in notifyPayload) {
        rtdbSet(RTDB_PATHS.auctionStatus(notifyPayload.auctionId), {
          type: FIREBASE_EVENTS.AUCTION_CLOSED,
          auctionId: notifyPayload.auctionId,
          status: 'EXPIRED',
          updatedAt: new Date().toISOString(),
        }).catch((e: unknown) => log.error('auction-logic: RTDB expiry sync failed', e, { auctionId: notifyPayload.auctionId }));
      } else {
        sendSaleNotifications(notifyPayload);
      }
    }
  } catch (e) {
    log.error('[auction-logic] closeAuctionIfEnded failed', e, { auctionId });
  }
}

// ─── closeAllEndedAuctions ───────────────────────────────────────────────────
export async function closeAllEndedAuctions(): Promise<void> {
  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .where('endTime', '<=', new Date())
    .limit(200)
    .get();

  if (snap.empty) return;

  const CONCURRENCY = 15;
  const ids = snap.docs.map((d) => d.id);

  log.info(`[Cron] Closing ${ids.length} ended auctions...`);

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((id) => closeAuctionIfEnded(id)));
  }
}
