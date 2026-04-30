import { db, snapDocs, newId, toSellerPublic, toSellerPrivate } from '@/lib/db';
import { Auction, AuctionFilters, AuctionWithSeller } from '@/types';
import { sanitizeObject } from '@/lib/sanitizer';
import { filterPII } from '@/lib/pii-filter';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import type { CreateAuctionInputValidated } from '@/lib/schemas';

export class AuctionService {
  /**
   * Fetch a single auction by ID with hydrated seller/winner info
   */
  static async getById(id: string, viewerId?: string | null): Promise<ServiceResponse<AuctionWithSeller>> {
    try {
      const doc = await db.collection('auctions').doc(id).get();
      if (!doc.exists) {
        return errorResponse(ErrorType.NOT_FOUND, 'Auction not found', 'AUCTION_NOT_FOUND');
      }

      const auctionData = doc.data()!;
      
      const userRefs = [db.collection('users').doc(auctionData.sellerId)];
      if (auctionData.winnerId) {
        userRefs.push(db.collection('users').doc(auctionData.winnerId));
      }
      
      const userSnaps = await db.getAll(...userRefs);
      const sellerSnap = userSnaps[0];
      const winnerSnap = userSnaps[1];
      
      // Authorization: Only allow the seller or the winner to see the seller's PII (phone)
      const isAuthorized = viewerId && (viewerId === auctionData.sellerId || viewerId === auctionData.winnerId);
      
      const data = {
        ...auctionData,
        id: doc.id,
        seller: isAuthorized 
          ? toSellerPrivate(sellerSnap.id, sellerSnap.data())! 
          : toSellerPublic(sellerSnap.id, sellerSnap.data())!,
        winner: winnerSnap?.exists ? { 
          id: winnerSnap.id, 
          name: winnerSnap.data()?.name || null, 
          image: winnerSnap.data()?.image || null 
        } : null,
        endTime: auctionData.endTime?.toDate ? auctionData.endTime.toDate() : new Date(auctionData.endTime),
      } as AuctionWithSeller;

      return successResponse(data);
    } catch (err) {
      log.error('Failed to get auction by ID', err, { auctionId: id });
      return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred while fetching the auction');
    }
  }

  /**
   * Fetch a paginated list of auctions with filters.
   * Uses Cursor Pagination (startAfter) for O(1) performance at scale.
   */
  static async list(filters: AuctionFilters & { limit?: number; lastId?: string; viewerId?: string | null }): Promise<ServiceResponse<{
    auctions: AuctionWithSeller[];
    total: number;
    lastId: string | null;
  }>> {
    try {
      const { category, status = 'ACTIVE', sortBy, sortOrder = 'desc', limit = 12, lastId, viewerId } = filters;

      let query: FirebaseFirestore.Query = db.collection('auctions');
      
      if (status) query = query.where('status', '==', status);
      if (category && category !== 'all') query = query.where('category', '==', category);
      if (filters.location && filters.location !== 'all') query = query.where('location', '==', filters.location);

      const ALLOWED_SORT_FIELDS = ['currentPrice', 'endTime', 'bidCount', 'createdAt', 'bids'];
      const orderField = (sortBy && ALLOWED_SORT_FIELDS.includes(sortBy)) 
        ? (sortBy === 'bids' ? 'bidCount' : sortBy) 
        : 'endTime';
      
      // Finalize Query with ordering
      let auctionsQuery = query.orderBy(orderField, sortOrder);

      // Pagination: Start after the last document seen in the previous batch
      if (lastId) {
        const lastDoc = await db.collection('auctions').doc(lastId).get();
        if (lastDoc.exists) {
          auctionsQuery = auctionsQuery.startAfter(lastDoc);
        }
      }

      const [totalSnap, auctionsSnap] = await Promise.all([
        query.count().get(),
        auctionsQuery.limit(limit).get()
      ]);

      const total = totalSnap.data().count;
      const auctionDocs = snapDocs<Auction>(auctionsSnap);

      // Hydration: Sellers + Watchlist (per viewer)
      const sellerIds = [...new Set(auctionDocs.map(a => a.sellerId))];
      const sellerSnaps = sellerIds.length > 0 ? await db.getAll(...sellerIds.map(id => db.collection('users').doc(id))) : [];
      const sellerMap = new Map(sellerSnaps.map(s => [s.id, toSellerPublic(s.id, s.data())]));

      // Sync Watchlist: If viewerId exists, check which auctions they've watchlisted
      let watchlistSet = new Set<string>();
      if (viewerId && auctionDocs.length > 0) {
        const watchlistSnap = await db.collection('users').doc(viewerId).collection('watchlist').get();
        watchlistSet = new Set(watchlistSnap.docs.map(d => d.data().auctionId));
      }

      const auctions = auctionDocs.map(a => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawEnd = a.endTime as any;
        const endTime = rawEnd?.toDate ? rawEnd.toDate() : new Date(rawEnd);
        
        return {
          ...a,
          seller: sellerMap.get(a.sellerId)!,
          endTime,
          isWatchlisted: watchlistSet.has(a.id)
        };
      }) as AuctionWithSeller[];

      return successResponse({
        auctions,
        total,
        lastId: auctionDocs.length > 0 ? auctionDocs[auctionDocs.length - 1].id : null,
      });
    } catch (err) {
      log.error('Failed to list auctions', err, { filters });
      return errorResponse(ErrorType.INTERNAL, 'Failed to retrieve auction listings');
    }
  }

  /**
   * Create a new auction listing
   */
  static async create(input: CreateAuctionInputValidated, userId: string): Promise<ServiceResponse<Auction>> {
    try {
      const sanitizedInput = sanitizeObject(input);
      const filteredTitle = filterPII(sanitizedInput.title);
      const filteredDescription = filterPII(sanitizedInput.description);

      const id = newId();
      const now = new Date();

      const auction: Auction = {
        id,
        title: filteredTitle,
        description: filteredDescription,
        images: sanitizedInput.images,
        category: sanitizedInput.category,
        startingPrice: sanitizedInput.startingPrice,
        currentPrice: sanitizedInput.startingPrice,
        // Denormalised so the bid transaction can read the previous top bidder
        // via tx.get(auctionRef) rather than a non-transactional query.
        currentBidderId: null,
        minBidIncrement: sanitizedInput.minBidIncrement ?? 10,
        startTime: new Date(sanitizedInput.startTime),
        endTime: new Date(sanitizedInput.endTime),
        reservePrice: sanitizedInput.reservePrice ?? null,
        buyItNowPrice: sanitizedInput.buyItNowPrice ?? null,
        location: sanitizedInput.location ?? null,
        sellerId: userId,
        winnerId: null,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        bidCount: 0,
        piiDetected: filteredTitle !== sanitizedInput.title || filteredDescription !== sanitizedInput.description
      };

      await db.collection('auctions').doc(id).set(auction);
      log.info('Auction created successfully', { auctionId: id, sellerId: userId });
      
      return successResponse(auction);
    } catch (err) {
      log.error('Failed to create auction', err, { userId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to create auction listing');
    }
  }
  /**
   * Transition an auction to a "Second Chance Offer" for the next highest bidder.
   * Triggered when the original winner fails to pay.
   */
  static async createSecondChanceOffer(auctionId: string): Promise<ServiceResponse<void>> {
    try {
      return await db.runTransaction(async (tx) => {
        const aRef = db.collection('auctions').doc(auctionId);
        const aSnap = await tx.get(aRef);
        if (!aSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');

        const auction = aSnap.data() as Auction;
        
        // Find second highest bidder (excluding the current non-paying winner)
        const bidsSnap = await db.collection('auctions').doc(auctionId)
          .collection('bids')
          .orderBy('amount', 'desc')
          .limit(2)
          .get();

        if (bidsSnap.docs.length < 2) {
          return errorResponse(ErrorType.NOT_FOUND, 'No second bidder available');
        }

        const secondBid = bidsSnap.docs[1].data();
        const secondBidderId = secondBid.bidderId;
        const secondAmount = secondBid.amount;

        tx.update(aRef, {
          status: 'OFFER_PENDING',
          currentBidderId: secondBidderId,
          currentPrice: secondAmount,
          updatedAt: new Date(),
          originalWinnerId: auction.currentBidderId, // Track who failed to pay
        });

        // Log the event
        log.info('Second chance offer created', { auctionId, secondBidderId, secondAmount });

        return successResponse(undefined);
      });
    } catch (err) {
      log.error('Failed to create second chance offer', err, { auctionId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to process second chance offer');
    }
  }
}
