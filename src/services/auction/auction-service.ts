import { db, snapDocs, newId, toSellerPublic, toSellerPrivate } from '@/lib/db';
import { Auction, AuctionFilters, AuctionWithSeller, SellerPublic, Bid, LatestActivity } from '@/types';
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
      
      // ─── DATA GATING ────────────────────────────────────────────────────────
      const isSeller = viewerId === auctionData.sellerId;
      const isWinner = viewerId === auctionData.winnerId;
      const isProxyOwner = viewerId === auctionData.proxyBidderId;
      
      const data = {
        ...auctionData,
        id: doc.id,
        // Hidden proxy fields are ONLY visible to the bidder who placed them
        proxyMaxBid: isProxyOwner ? auctionData.proxyMaxBid : undefined,
        proxyBidderId: isProxyOwner ? auctionData.proxyBidderId : undefined,
        
        seller: (isSeller || isWinner)
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

      // Sync Watchlist: If viewerId exists, check only the auctions currently being displayed.
      // Firestore 'in' queries are capped at 30 items (our default limit is 12).
      let watchlistSet = new Set<string>();
      if (viewerId && auctionDocs.length > 0) {
        const auctionIds = auctionDocs.map(a => a.id).slice(0, 30);
        const watchlistSnap = await db.collection('users').doc(viewerId)
          .collection('watchlist')
          .where('auctionId', 'in', auctionIds)
          .get();
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
        condition: sanitizedInput.condition ?? null,
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
        const bidsSnap = await db.collection('bids')
          .where('auctionId', '==', auctionId)
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

  /**
   * Fetch specialized homepage feeds (ending soon and latest bids)
   */
  static async getSpecializedFeeds(): Promise<ServiceResponse<{ 
    endingSoon: AuctionWithSeller[], 
    latestBids: LatestActivity[] 
  }>> {
    try {
      const nowTs = new Date();
      const in48h = new Date(nowTs.getTime() + 48 * 60 * 60 * 1000);

      const [endingSoonSnap, latestBidsSnap] = await Promise.all([
        db.collection('auctions')
          .where('status', '==', 'ACTIVE')
          .where('endTime', '>', nowTs)
          .where('endTime', '<=', in48h)
          .orderBy('endTime', 'asc')
          .limit(8)
          .get(),
        db.collection('bids')
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get(),
      ]);

      const endingDocs = snapDocs<Auction>(endingSoonSnap);
      const sellerIds = [...new Set(endingDocs.map((a) => a.sellerId))];
      let sellerMap = new Map<string, SellerPublic>();
      if (sellerIds.length > 0) {
        const sellerSnaps = await db.getAll(...sellerIds.map(id => db.collection('users').doc(id)));
        sellerMap = new Map(sellerSnaps.map(s => [s.id, toSellerPublic(s.id, s.data())!]));
      }

      const endingSoon = endingDocs.map((a) => ({
        ...a,
        seller: sellerMap.get(a.sellerId)!,
        endTime: (a.endTime as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.endTime as unknown as Date),
      })) as AuctionWithSeller[];

      const bidDocs = latestBidsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Bid));
      const bidderIds = [...new Set(bidDocs.map((b) => b.bidderId))];
      const auctionIds = [...new Set(bidDocs.map((b) => b.auctionId))];
      
      let biddersMap = new Map<string, { name: string | null }>();
      let auctionsMap = new Map<string, { id: string; title: string; status: string }>();

      if (bidderIds.length > 0 && auctionIds.length > 0) {
        const bidderSnaps = await db.getAll(...bidderIds.map(id => db.collection('users').doc(id)));
        const auctionSnaps = await db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id)));
        
        biddersMap = new Map(bidderSnaps.map((s) => [s.id, { name: (s.data()?.name as string | null) ?? null }]));
        auctionsMap = new Map(auctionSnaps.map((s) => [s.id, { id: s.id, title: (s.data()?.title as string | undefined) ?? 'Unknown', status: (s.data()?.status as string | undefined) ?? '' }]));
      }

      const latestBids: LatestActivity[] = bidDocs
        .filter((b) => auctionsMap.get(b.auctionId)?.status === 'ACTIVE')
        .slice(0, 10)
        .map((b) => {
          const createdAtRaw = b.createdAt as unknown as { toDate?: () => Date } | Date;
          const createdAt = createdAtRaw instanceof Date ? createdAtRaw : createdAtRaw?.toDate?.() ?? new Date();
          const auctionEntry = auctionsMap.get(b.auctionId) ?? { id: b.auctionId, title: 'Unknown' };
          return {
            id: b.id,
            amount: b.amount,
            createdAt,
            bidder: biddersMap.get(b.bidderId) ?? { name: null },
            auction: { id: auctionEntry.id, title: auctionEntry.title },
          };
        });

      return successResponse({ endingSoon, latestBids });
    } catch (error) {
      log.error('AuctionService.getSpecializedFeeds failed', error);
      return errorResponse(ErrorType.INTERNAL, 'Failed to fetch specialized feeds');
    }
  }
}
