import 'server-only';
import { db } from '@/lib/db';
import { sendAuctionWonEmail } from '@/lib/firebase-email';
import type { AuctionStatus } from '@/types';

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

  // Non-blocking winner email
  if (winner.email) {
    sendAuctionWonEmail(winner.email, auction.title, finalPrice, auction.id).catch(console.error);
  }
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

      // 1. Get the top bidder
      const bidsSnap = await db.collection('bids')
        .where('auctionId', '==', auctionId)
        .orderBy('amount', 'desc')
        .limit(1)
        .get();

      if (bidsSnap.empty) {
        tx.update(aRef, { status: 'EXPIRED', updatedAt: now });
        return;
      }

      const topBid = bidsSnap.docs[0].data();
      
      // 2. FETCH WINNER & SELLER DATA (Required for emails and escrow logic)
      // Note: Inside transaction, we MUST use tx.get
      const [winnerSnap, sellerSnap] = await Promise.all([
        tx.get(db.collection('users').doc(topBid.bidderId)),
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
          id: topBid.bidderId, 
          email: winnerData.email ?? null, 
          name: winnerData.name ?? 'Winner' 
        },
        topBid.amount,
      );
    });
  } catch (e) {
    console.error('[auction-logic] closeAuctionIfEnded failed:', auctionId, e);
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
