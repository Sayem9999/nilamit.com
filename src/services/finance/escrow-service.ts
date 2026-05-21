import { db, snapDocs } from '@/lib/db';
import { HydratedEscrowTransaction, EscrowTransaction, Auction, Dispute } from '@/types';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';

export class EscrowService {
  /**
   * Fetch hydrated escrow transactions for a specific buyer.
   */
  static async getBuyerEscrows(buyerId: string): Promise<ServiceResponse<HydratedEscrowTransaction[]>> {
    try {
      const snap = await db.collection('escrowTransactions')
        .where('buyerId', '==', buyerId)
        .orderBy('createdAt', 'desc')
        .get();

      if (snap.empty) return successResponse([]);

      const escrowDocs = snapDocs<EscrowTransaction>(snap);
      const auctionIds = [...new Set(escrowDocs.map(e => e.auctionId))];

      // Batch auctions
      const auctionSnaps = await db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id)));
      const auctionMap = new Map<string, Auction>();
      
      const sellerIds = new Set<string>();
      auctionSnaps.forEach(s => {
        if (s.exists) {
          const data = s.data() as Auction;
          auctionMap.set(s.id, { ...data, id: s.id });
          sellerIds.add(data.sellerId);
        }
      });

      // Batch sellers
      const sellerSnaps = await db.getAll(...Array.from(sellerIds).map(id => db.collection('users').doc(id)));
      const sellerMap = new Map<string, { name: string | null; image: string | null }>();
      sellerSnaps.forEach(s => {
        if (s.exists) {
          const data = s.data()!;
          sellerMap.set(s.id, { name: data.name || null, image: data.image || null });
        }
      });

      // Batch disputes
      const disputeSnaps = escrowDocs.length > 0
        ? await db.getAll(...escrowDocs.map(e => db.collection('disputes').doc(e.id)))
        : [];
      const disputeMap = new Map<string, Dispute | null>();
      disputeSnaps.forEach((s) => {
        if (s.exists) {
          disputeMap.set(s.id, { ...s.data(), id: s.id } as Dispute);
        } else {
          disputeMap.set(s.id, null);
        }
      });

      const toDate = (val: unknown): Date | null => {
        if (!val) return null;
        if (typeof val === 'object' && val !== null && 'toDate' in val) {
          const obj = val as Record<string, unknown>;
          if (typeof obj.toDate === 'function') {
            return (obj.toDate as () => Date)();
          }
        }
        return new Date(val as string | number);
      };

      const sanitizeLogistics = (l: {
        status?: string;
        trackingId?: string;
        updatedAt?: unknown;
        history?: unknown[];
      } | undefined) => {
        if (!l) return undefined;
        const history = Array.isArray(l.history) ? l.history.map((h: unknown) => {
          const item = h as Record<string, unknown>;
          return {
            ...item,
            timestamp: toDate(item.timestamp)
          };
        }) : [];
        return {
          ...l,
          updatedAt: toDate(l.updatedAt),
          history
        };
      };

      const hydrated = escrowDocs.map(e => {
        const auction = auctionMap.get(e.auctionId);
        if (!auction) return null;

        const seller = sellerMap.get(auction.sellerId) || { name: 'Unknown', image: null };

        const sanitizedAuction = {
          ...auction,
          startTime: toDate(auction.startTime),
          endTime: toDate(auction.endTime),
          createdAt: toDate(auction.createdAt),
          updatedAt: toDate(auction.updatedAt),
          logistics: sanitizeLogistics(auction.logistics),
          seller
        };

        const rawDispute = disputeMap.get(e.id);
        const sanitizedDispute = rawDispute ? {
          ...rawDispute,
          createdAt: toDate(rawDispute.createdAt),
          updatedAt: toDate(rawDispute.updatedAt),
        } : null;

        return {
          ...e,
          createdAt: toDate(e.createdAt),
          updatedAt: toDate(e.updatedAt),
          auction: sanitizedAuction,
          dispute: sanitizedDispute
        } as unknown as HydratedEscrowTransaction;
      }).filter((x): x is HydratedEscrowTransaction => x !== null);

      return successResponse(hydrated);
    } catch (err) {
      log.error('EscrowService.getBuyerEscrows failed', err, { buyerId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to fetch escrow transactions');
    }
  }
}
