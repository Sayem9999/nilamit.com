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
      const disputeSnaps = await Promise.all(escrowDocs.map(e => 
        db.collection('disputes').where('transactionId', '==', e.id).limit(1).get()
      ));
      const disputeMap = new Map<string, Dispute | null>();
      disputeSnaps.forEach((s, i) => {
        const txId = escrowDocs[i].id;
        if (!s.empty) {
          const d = s.docs[0];
          disputeMap.set(txId, { ...d.data(), id: d.id } as Dispute);
        } else {
          disputeMap.set(txId, null);
        }
      });

      const hydrated = escrowDocs.map(e => {
        const auction = auctionMap.get(e.auctionId);
        if (!auction) return null;

        const seller = sellerMap.get(auction.sellerId) || { name: 'Unknown', image: null };

        return {
          ...e,
          auction: {
            ...auction,
            seller
          },
          dispute: disputeMap.get(e.id) || null
        } as HydratedEscrowTransaction;
      }).filter((x): x is HydratedEscrowTransaction => x !== null);

      return successResponse(hydrated);
    } catch (err) {
      log.error('EscrowService.getBuyerEscrows failed', err, { buyerId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to fetch escrow transactions');
    }
  }
}
