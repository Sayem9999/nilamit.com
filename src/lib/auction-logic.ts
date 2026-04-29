import 'server-only';
import { db } from '@/lib/db';
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

// ─── processAuctionSale ──────────────────────────────────────────────────────
/**
 * Centralised sale logic — must be called inside a Firestore transaction.
 * Updates auction → SOLD and creates / upserts EscrowTransaction.
 */
export async function processAuctionSale(
  transaction: FirebaseFirestore.Transaction,
  auction: {
    id: string; title: string; sellerId: string;
    deliveryCharge?: number | null;
    reservePrice?: number | null;
  },
  seller: { id: string; isVerifiedSeller: boolean },
  winner: { id: string; email: string | null; name: string | null },
  finalPrice: number,
) {
  if (auction.reservePrice && finalPrice < auction.reservePrice) {
    throw new Error('Reserve price not met.');
  }

  const { fee, rate } = calculateSuccessFee(finalPrice);
  const now = new Date();

  const auctionRef = db.collection('auctions').doc(auction.id);
  transaction.update(auctionRef, {
    status:          'SOLD' as AuctionStatus,
    winnerId:        winner.id,
    commissionRate:  rate,
    commissionEarned: fee,
    updatedAt:       now,
  });

  // Escrow doc ID = auctionId for idempotent upsert
  const deliveryCharge = auction.deliveryCharge ?? 0;
  const escrowAmount   = seller.isVerifiedSeller ? finalPrice : fee + deliveryCharge;
  const escrowRef      = db.collection('escrowTransactions').doc(auction.id);
  transaction.set(escrowRef, {
    id:               auction.id,
    auctionId:        auction.id,
    buyerId:          winner.id,
    amount:           escrowAmount,
    status:           'PENDING',
    paymentMethod:    null,
    providerRef:      null,
    verificationType: null,
    createdAt:        now,
    updatedAt:        now,
  }, { merge: true });

  // Non-blocking post-sale notifications (fire-and-forget outside the transaction)
  if (winner.email) {
    sendAuctionWonEmail(winner.email, auction.title, finalPrice, auction.id)
      .catch((e) => log.error('auction-logic: winner email failed', e, { auctionId: auction.id }));
  }
  rtdbPush(RTDB_PATHS.userNotifications(winner.id), {
    event:     FIREBASE_EVENTS.AUCTION_WON,
    auctionId: auction.id,
    title:     auction.title,
    amount:    finalPrice,
  }).catch((e) => log.error('auction-logic: winner RTDB notification failed', e, { auctionId: auction.id }));
}

// ─── closeAuctionIfEnded ─────────────────────────────────────────────────────
export async function closeAuctionIfEnded(auctionId: string): Promise<void> {
  try {
    await db.runTransaction(async (tx) => {
      const aRef  = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) return;
      
      const a = aSnap.data()!;
      if (a.status !== 'ACTIVE') return;

      const now     = new Date();
      const endTime = a.endTime?.toDate ? a.endTime.toDate() : new Date(a.endTime);
      if (now < endTime) return;

      // Read winner from the transactionally-locked auction doc itself.
      // BiddingService denormalises every bid onto `currentBidderId` /
      // `currentPrice`, so we never need a non-transactional bids query
      // here — that would expose a lost-update race against late bids.
      const winnerId: string | null = a.currentBidderId ?? null;
      const finalPrice: number | null = a.currentPrice ?? null;

      if (!winnerId || !finalPrice) {
        tx.update(aRef, { status: 'EXPIRED', updatedAt: now });
        return;
      }

      // FETCH WINNER & SELLER DATA via tx.get so they're locked in this tx.
      const [winnerSnap, sellerSnap] = await Promise.all([
        tx.get(db.collection('users').doc(winnerId)),
        tx.get(db.collection('users').doc(a.sellerId))
      ]);

      const winnerData = winnerSnap.data() || {};
      const sellerData = sellerSnap.data() || {};

      await processAuctionSale(
        tx,
        { id: auctionId, title: a.title, sellerId: a.sellerId,
          deliveryCharge: a.deliveryCharge, reservePrice: a.reservePrice },
        { id: a.sellerId, isVerifiedSeller: sellerData.isVerifiedSeller ?? false },
        {
          id: winnerId,
          email: winnerData.email ?? null,
          name: winnerData.name ?? 'Winner'
        },
        finalPrice,
      );
    });
  } catch (e) {
    log.error('[auction-logic] closeAuctionIfEnded failed', e, { auctionId });
  }
}

// ─── closeAllEndedAuctions ───────────────────────────────────────────────────
export async function closeAllEndedAuctions(): Promise<void> {
  // Fetch only a reasonable batch to avoid timeout/memory issues in cron
  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .where('endTime', '<=', new Date())
    .limit(50) 
    .get();

  if (snap.empty) return;

  // Execute in sequence or small controlled chunks in production
  // to avoid Firestore transaction contention on the same indices
  for (const doc of snap.docs) {
    await closeAuctionIfEnded(doc.id);
  }
}
