import 'server-only';
import { randomUUID } from 'crypto';
import { db, incrementGlobalStat } from '@/lib/db';
import { sendAuctionWonEmail } from '@/lib/firebase-email';
import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import type { AuctionStatus, SystemConfig } from '@/types';
import { log } from '@/lib/logger';
import { scheduleEnforcePaymentPolicy } from '@/lib/cloud-tasks';
// Commission tiers live in a pure, unit-tested module (this file is server-only).
import { calculateSuccessFee } from '@/services/finance/commission';
export { calculateSuccessFee };

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
  systemConfig?: SystemConfig | null,
): SaleNotifyPayload {
  if (auction.reservePrice && finalPrice < auction.reservePrice) {
    throw new Error('Reserve price not met.');
  }

  const commissionEnabled = systemConfig?.commissionPercentageEnabled ?? true;
  const customPercentage = systemConfig?.commissionPercentage;
  const { fee, rate } = commissionEnabled ? calculateSuccessFee(finalPrice, customPercentage) : { fee: 0, rate: 0 };
  const now = new Date();

  const auctionRef = db.collection('auctions').doc(auction.id);
  transaction.update(auctionRef, {
    status:           'SOLD' as AuctionStatus,
    winnerId:         winner.id,
    commissionRate:   rate,
    commissionEarned: fee,
    updatedAt:        now,
  });

  // Calculate amounts dynamically based on SystemConfig (Traditional Escrow vs COD-Escrow Hybrid)
  const deliveryCharge = auction.deliveryCharge ?? 0;
  const hybridEnabled  = systemConfig?.hybridEscrowEnabled ?? false;
  const commitmentPct  = systemConfig?.hybridCommitmentPercentage ?? 2;

  const advanceAmount = hybridEnabled
    ? deliveryCharge + Math.round(finalPrice * (commitmentPct / 100))
    : finalPrice + deliveryCharge;

  const codAmount = hybridEnabled
    ? finalPrice - Math.round(finalPrice * (commitmentPct / 100))
    : 0;

  const totalAmount = finalPrice + deliveryCharge;

  const escrowRequired = systemConfig?.escrowRequired ?? true;
  const escrowStatus = escrowRequired ? 'PENDING' : 'RELEASED';

  const escrowRef = db.collection('escrowTransactions').doc(auction.id);
  // set() without merge so a second call can never silently re-open a closed escrow.
  transaction.set(escrowRef, {
    id:               auction.id,
    auctionId:        auction.id,
    buyerId:          winner.id,
    sellerId:         auction.sellerId,
    amount:           advanceAmount,
    totalAmount:      totalAmount,
    codAmount:        codAmount,
    deliveryDeposit:  deliveryCharge,
    status:           escrowStatus,
    paymentMethod:    null,
    providerRef:      null,
    verificationType: null,
    // High-entropy token the payment webhook matches against
    // (PaymentService.verifyAndReleaseEscrow). The payment init flow seeds this
    // into the gateway session (SSLCommerz `value_a`) and the gateway echoes it
    // back on callback. It is NEVER exposed to the client. Previously this was
    // the public auctionId, which let anyone with the webhook secret release any
    // escrow by guessing the token (audit finding C2).
    automationToken:  randomUUID(),
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
    auctionTitle: payload.title,
    amount:    payload.finalPrice,
    timestamp: Date.now(),
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

        // Notify RTDB of expiry after the transaction commits.
        return { expired: true, auctionId, sellerId: a.sellerId as string, title: a.title as string, reason: 'NO_BIDS' as const };
      }

      // Reserve-price guard — handle BEFORE processAuctionSale (which throws on
      // an unmet reserve). Throwing here would reject the transaction, leave the
      // auction ACTIVE with a past endTime, and make the cron re-process it on
      // every run forever. Instead we mark it EXPIRED (unsold) once.
      if (a.reservePrice && finalPrice < a.reservePrice) {
        tx.update(aRef, { status: 'EXPIRED', isReserveMet: false, updatedAt: now });
        return { expired: true, auctionId, sellerId: a.sellerId as string, title: a.title as string, reason: 'RESERVE_NOT_MET' as const };
      }

      const configRef = db.collection('systemConfig').doc('default');
      const [winnerSnap, sellerSnap, configSnap] = await Promise.all([
        tx.get(db.collection('users').doc(winnerId)),
        tx.get(db.collection('users').doc(a.sellerId)),
        tx.get(configRef),
      ]);

      const winnerData = winnerSnap.data() || {};
      const sellerData = sellerSnap.data() || {};
      const systemConfig = configSnap.exists ? configSnap.data() as SystemConfig : null;

      return processAuctionSale(
        tx,
        { id: auctionId, title: a.title, sellerId: a.sellerId,
          deliveryCharge: a.deliveryCharge, reservePrice: a.reservePrice },
        { id: a.sellerId, isVerifiedSeller: sellerData.isVerifiedSeller ?? false },
        { id: winnerId, email: winnerData.email ?? null, name: winnerData.name ?? 'Winner' },
        finalPrice,
        systemConfig,
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

        // Tell the seller why their listing closed without a sale.
        const message = notifyPayload.reason === 'RESERVE_NOT_MET'
          ? `"${notifyPayload.title}" ended below your reserve price and did not sell.`
          : `"${notifyPayload.title}" ended without any bids.`;
        rtdbPush(RTDB_PATHS.userNotifications(notifyPayload.sellerId), {
          event: FIREBASE_EVENTS.AUCTION_CLOSED,
          auctionId: notifyPayload.auctionId,
          auctionTitle: notifyPayload.title,
          message,
          timestamp: Date.now(),
        }).catch((e: unknown) => log.error('auction-logic: seller expiry notification failed', e, { auctionId: notifyPayload.auctionId }));
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
  const BATCH = 200;
  const CONCURRENCY = 15;
  // Safety ceiling so a pathological backlog can't run past the cron timeout.
  // 40 * 200 = 8,000 auctions per invocation; the remainder is picked up on the
  // next run. closeAuctionIfEnded flips status to SOLD/EXPIRED, so a closed
  // auction never reappears in the query — the loop terminates naturally.
  const MAX_BATCHES = 40;

  let totalClosed = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const snap = await db.collection('auctions')
      .where('status', '==', 'ACTIVE')
      .where('endTime', '<=', new Date())
      .limit(BATCH)
      .get();

    if (snap.empty) break;

    const ids = snap.docs.map((d) => d.id);
    log.info(`[Cron] Closing ${ids.length} ended auctions (batch ${batch + 1})...`);

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((id) => closeAuctionIfEnded(id)));
    }
    totalClosed += ids.length;

    // A short page means we've drained the backlog for this run.
    if (ids.length < BATCH) break;
  }

  if (totalClosed > 0) log.info(`[Cron] Closed ${totalClosed} ended auctions this run.`);
}
