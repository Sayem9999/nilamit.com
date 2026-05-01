import 'server-only';
import { db } from '@/lib/db';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAuctionWonEmail } from '@/lib/firebase-email';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import type { AuctionStatus } from '@/types';
import { log } from '@/lib/logger';

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
}

// ─── processAuctionSale ──────────────────────────────────────────────────────
/**
 * Called inside a Firestore transaction — writes auction + escrow updates only.
 * Returns notification data; the CALLER is responsible for firing notifications
 * AFTER the transaction commits to prevent duplicate sends on tx retries.
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
  // Previously unverified sellers only had fee+delivery held, leaving buyers with
  // almost no protection on large purchases. Commission is extracted on release.
  const deliveryCharge = auction.deliveryCharge ?? 0;
  const escrowAmount   = finalPrice + deliveryCharge;

  // ─── Aggregator: Increment Global Revenue ──────────────────────────────────
  // Track platform revenue in a single document to avoid O(N) scans in Admin UI.
  const statsRef = db.collection('stats').doc('global');
  transaction.set(statsRef, {
    totalRevenue: FieldValue.increment(fee),
    updatedAt: now
  }, { merge: true });

  const escrowRef = db.collection('escrowTransactions').doc(auction.id);
  // set() without merge so a second call can never silently re-open a closed escrow
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

  // Return payload — notifications fired by caller AFTER commit
  return { winnerId: winner.id, sellerId: auction.sellerId, winnerEmail: winner.email, auctionId: auction.id, title: auction.title, finalPrice };
}

import { processSaleGamification } from '@/actions/gamification';

// ─── sendSaleNotifications ───────────────────────────────────────────────────
export function sendSaleNotifications(payload: SaleNotifyPayload) {
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

  // Gamification: XP and Streaks
  processSaleGamification(payload.winnerId, payload.sellerId).catch((e) => 
    log.error('auction-logic: sale gamification failed', e, { auctionId: payload.auctionId })
  );
}

// ─── closeAuctionIfEnded ─────────────────────────────────────────────────────
export async function closeAuctionIfEnded(auctionId: string): Promise<void> {
  try {
    const notifyPayload = await db.runTransaction(async (tx) => {
      const aRef  = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) return null;

      const a = aSnap.data()!;
      if (a.status !== 'ACTIVE') return null;

      const now     = new Date();
      const endTime = a.endTime?.toDate ? a.endTime.toDate() : new Date(a.endTime);
      if (now < endTime) return null;

      // Winner is denormalised onto the auction doc — transactionally safe;
      // a collection query here would not be locked and could race late bids.
      const winnerId:    string | null = a.currentBidderId ?? null;
      const finalPrice:  number | null = a.currentPrice    ?? null;

      if (!winnerId || !finalPrice) {
        tx.update(aRef, { status: 'EXPIRED', updatedAt: now });
        return null;
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

    // Fire notifications only after the transaction has committed successfully
    if (notifyPayload) sendSaleNotifications(notifyPayload);
  } catch (e) {
    log.error('[auction-logic] closeAuctionIfEnded failed', e, { auctionId });
  }
}

// ─── closeAllEndedAuctions ───────────────────────────────────────────────────
export async function closeAllEndedAuctions(): Promise<void> {
  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .where('endTime', '<=', new Date())
    .limit(50)
    .get();

  if (snap.empty) return;

  // Process with a concurrency cap to balance throughput against Firestore
  // transaction contention. 10 concurrent is safe; sequential was too slow
  // (50 × ~500ms = ~25s, dangerously close to 60s Cloud Run timeout).
  const CONCURRENCY = 10;
  const ids = snap.docs.map((d) => d.id);

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) => closeAuctionIfEnded(id)));
  }
}
