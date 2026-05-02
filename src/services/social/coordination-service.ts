import { db, snapDocs } from '@/lib/db';
import { Conversation, Message, CoordinationHubItem, Auction, EscrowTransaction } from '@/types';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';

export class CoordinationService {
  /**
   * Fetch hydrated coordination items for a user (either buyer or seller).
   */
  static async getActiveCoordination(userId: string): Promise<ServiceResponse<CoordinationHubItem[]>> {
    try {
      const [buyerConvSnap, sellerConvSnap] = await Promise.all([
        db.collection('conversations').where('buyerId', '==', userId).get(),
        db.collection('conversations').where('sellerId', '==', userId).get(),
      ]);

      const convDocs = [
        ...snapDocs<Conversation>(buyerConvSnap),
        ...snapDocs<Conversation>(sellerConvSnap)
      ];

      // Deduplicate by ID
      const uniqueConvs = Array.from(new Map(convDocs.map(c => [c.id, c])).values());

      if (uniqueConvs.length === 0) return successResponse([]);

      const auctionIds = [...new Set(uniqueConvs.map(c => c.auctionId))];

      // Batch auctions and escrows
      const [auctionSnaps, escrowSnaps] = await Promise.all([
        db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id))),
        db.getAll(...auctionIds.map(id => db.collection('escrowTransactions').doc(id))),
      ]);

      const auctionMap = new Map<string, Auction>();
      auctionSnaps.forEach(s => {
        if (s.exists) auctionMap.set(s.id, { ...s.data(), id: s.id } as Auction);
      });

      const escrowMap = new Map<string, EscrowTransaction>();
      escrowSnaps.forEach(s => {
        if (s.exists) escrowMap.set(s.id, { ...s.data(), id: s.id } as EscrowTransaction);
      });

      // Batch last messages
      const messageSnaps = await Promise.all(uniqueConvs.map(conv =>
        db.collection('messages')
          .where('conversationId', '==', conv.id)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get()
      ));

      const items = uniqueConvs.map((conv, i) => {
        const auction = auctionMap.get(conv.auctionId);
        const escrow = escrowMap.get(conv.auctionId);
        
        if (!auction || !escrow) return null;
        
        // Coordination only shows for active/held/disputed states
        if (!['HELD', 'DISPUTED'].includes(escrow.status)) return null;

        const messages = messageSnaps[i].docs.map(d => ({ ...d.data(), id: d.id } as Message));

        return {
          ...conv,
          auction: {
            id: auction.id,
            title: auction.title,
            images: auction.images || [],
            escrowTransaction: { status: escrow.status, id: escrow.id },
            logistics: auction.logistics ? { status: auction.logistics.status, trackingId: auction.logistics.trackingId } : undefined,
          },
          messages
        } as CoordinationHubItem;
      }).filter((x): x is CoordinationHubItem => x !== null)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      return successResponse(items);
    } catch (err) {
      log.error('CoordinationService.getActiveCoordination failed', err, { userId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to fetch coordination items');
    }
  }
}
