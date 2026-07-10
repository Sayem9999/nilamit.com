/**
 * offer-service.ts — Best Offer domain logic (eBay-style "Make an Offer").
 *
 * A buyer proposes a price on a live listing; the seller accepts or declines.
 * Accepting closes the auction through the SAME transactional sale path as
 * Buy It Now (processAuctionSale) — escrow, conversation, and notifications
 * all behave identically to a BIN purchase at the offered price.
 *
 * Offers live in the `offers` collection, doc ID `${auctionId}_${buyerId}`
 * (one live offer per buyer per listing — a new offer from the same buyer
 * overwrites their previous one and resets it to PENDING).
 *
 * Plain server lib — NOT 'use server'. Entry points live in
 * src/actions/offer.ts (CLAUDE.md rule 19).
 */
import 'server-only';
import { db } from '@/lib/db';
import { ERROR_CODES } from '@/lib/constants';
import { processAuctionSale, type SaleNotifyPayload } from '@/lib/auction-logic';
import type { SystemConfig } from '@/types';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface OfferDoc {
  id: string;
  auctionId: string;
  auctionTitle: string;
  buyerId: string;
  buyerName: string | null;
  sellerId: string;
  amount: number;
  message: string | null;
  status: OfferStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface MakeOfferResult {
  offerId: string;
  sellerId: string;
  auctionTitle: string;
  amount: number;
  buyerName: string | null;
}

export interface RespondResult {
  buyerId: string;
  auctionId: string;
  auctionTitle: string;
  amount: number;
  accepted: boolean;
  /** Present only on accept — fire sendSaleNotifications AFTER commit. */
  salePayload: SaleNotifyPayload | null;
}

const toDate = (v: unknown): Date =>
  (v as { toDate?: () => Date })?.toDate?.() ?? new Date(v as string | number | Date);

export class OfferService {
  /**
   * Create (or replace the buyer's previous) offer on a live auction.
   */
  static async makeOffer(
    buyerId: string,
    buyerName: string | null,
    auctionId: string,
    amount: number,
    message: string | undefined,
  ): Promise<MakeOfferResult> {
    const offerId = `${auctionId}_${buyerId}`;

    return db.runTransaction(async (tx) => {
      const aRef = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);
      const auction = aSnap.data()!;

      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      const now = new Date();
      const endTime = toDate(auction.endTime);
      if (now >= endTime) throw new Error(ERROR_CODES.AUCTION_ENDED);
      if (auction.sellerId === buyerId) throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);

      // An offer at/above the BIN price makes no sense — just buy it.
      if (auction.buyItNowPrice && amount >= auction.buyItNowPrice) {
        throw new Error('OFFER_ABOVE_BIN');
      }
      // Once real bids exist, an offer must beat the current high bid or the
      // seller would be accepting less than the auction already guarantees.
      if ((auction.bidCount ?? 0) > 0 && amount <= (auction.currentPrice ?? 0)) {
        throw new Error(ERROR_CODES.BID_TOO_LOW);
      }

      const offerRef = db.collection('offers').doc(offerId);
      tx.set(offerRef, {
        id: offerId,
        auctionId,
        auctionTitle: auction.title ?? 'Auction',
        buyerId,
        buyerName,
        sellerId: auction.sellerId,
        amount,
        message: message?.trim() || null,
        status: 'PENDING' as OfferStatus,
        createdAt: now,
        respondedAt: null,
      });

      return {
        offerId,
        sellerId: auction.sellerId as string,
        auctionTitle: (auction.title as string) ?? 'Auction',
        amount,
        buyerName,
      };
    });
  }

  /**
   * Seller accepts or declines a pending offer. Accepting sells the auction
   * at the offered price via processAuctionSale and auto-declines every other
   * pending offer on the listing.
   */
  static async respondToOffer(
    sellerId: string,
    offerId: string,
    response: 'ACCEPT' | 'DECLINE',
  ): Promise<RespondResult> {
    return db.runTransaction(async (tx) => {
      // ── All reads first (Firestore transaction contract) ──
      const offerRef = db.collection('offers').doc(offerId);
      const offerSnap = await tx.get(offerRef);
      if (!offerSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);
      const offer = offerSnap.data()!;

      if (offer.sellerId !== sellerId) throw new Error(ERROR_CODES.FORBIDDEN);
      if (offer.status !== 'PENDING') throw new Error('OFFER_ALREADY_RESOLVED');

      const now = new Date();

      if (response === 'DECLINE') {
        tx.update(offerRef, { status: 'DECLINED', respondedAt: now });
        return {
          buyerId: offer.buyerId as string,
          auctionId: offer.auctionId as string,
          auctionTitle: (offer.auctionTitle as string) ?? 'Auction',
          amount: offer.amount as number,
          accepted: false,
          salePayload: null,
        };
      }

      const aRef = db.collection('auctions').doc(offer.auctionId);
      const [aSnap, sellerSnap, configSnap, buyerSnap, otherOffersSnap] = await Promise.all([
        tx.get(aRef),
        tx.get(db.collection('users').doc(sellerId)),
        tx.get(db.collection('systemConfig').doc('default')),
        tx.get(db.collection('users').doc(offer.buyerId)),
        tx.get(
          db.collection('offers')
            .where('auctionId', '==', offer.auctionId)
            .where('status', '==', 'PENDING'),
        ),
      ]);

      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);
      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      if (now >= toDate(auction.endTime)) throw new Error(ERROR_CODES.AUCTION_ENDED);

      const buyer = buyerSnap.data() ?? {};
      const systemConfig = configSnap.exists ? (configSnap.data() as SystemConfig) : null;

      // ── Writes ──
      const salePayload = processAuctionSale(
        tx,
        {
          id: offer.auctionId,
          title: auction.title,
          sellerId,
          deliveryCharge: auction.deliveryCharge,
          reservePrice: auction.reservePrice,
        },
        { id: sellerId, isVerifiedSeller: sellerSnap.data()?.isVerifiedSeller ?? false },
        {
          id: offer.buyerId,
          email: (buyer.email as string) ?? null,
          name: (buyer.name as string) ?? null,
        },
        offer.amount as number,
        systemConfig,
      );

      tx.update(offerRef, { status: 'ACCEPTED', respondedAt: now });
      for (const d of otherOffersSnap.docs) {
        if (d.id !== offerId) tx.update(d.ref, { status: 'DECLINED', respondedAt: now });
      }

      return {
        buyerId: offer.buyerId as string,
        auctionId: offer.auctionId as string,
        auctionTitle: (offer.auctionTitle as string) ?? 'Auction',
        amount: offer.amount as number,
        accepted: true,
        salePayload,
      };
    });
  }

  /**
   * Offers visible to a viewer on an auction: the seller sees all of them,
   * a buyer sees only their own.
   */
  static async getOffersFor(viewerId: string, auctionId: string): Promise<OfferDoc[]> {
    const aSnap = await db.collection('auctions').doc(auctionId).get();
    if (!aSnap.exists) return [];
    const isSeller = aSnap.data()!.sellerId === viewerId;

    if (!isSeller) {
      const own = await db.collection('offers').doc(`${auctionId}_${viewerId}`).get();
      return own.exists ? [normalize(own.data()!)] : [];
    }

    const snap = await db
      .collection('offers')
      .where('auctionId', '==', auctionId)
      .limit(50)
      .get();
    return snap.docs
      .map((d) => normalize(d.data()!))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

function normalize(d: FirebaseFirestore.DocumentData): OfferDoc {
  return {
    id: d.id,
    auctionId: d.auctionId,
    auctionTitle: d.auctionTitle ?? 'Auction',
    buyerId: d.buyerId,
    buyerName: d.buyerName ?? null,
    sellerId: d.sellerId,
    amount: d.amount,
    message: d.message ?? null,
    status: d.status,
    createdAt: toDate(d.createdAt),
    respondedAt: d.respondedAt ? toDate(d.respondedAt) : null,
  };
}
