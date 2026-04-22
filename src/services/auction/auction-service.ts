import { db, snapDocs, newId } from '@/lib/db';
import { Auction, AuctionFilters, AuctionWithSeller, CreateAuctionInput } from '@/types';
import { toSellerPublic } from '@/lib/db';
import { sanitizeObject } from '@/lib/sanitizer';
import { filterPII } from '@/lib/pii-filter';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';

export class AuctionService {
  /**
   * Fetch a single auction with seller details
   */
  static async getById(id: string): Promise<ServiceResponse<AuctionWithSeller>> {
    try {
      const doc = await db.collection('auctions').doc(id).get();
      if (!doc.exists) {
        return errorResponse(ErrorType.NOT_FOUND, 'Auction not found', 'AUCTION_NOT_FOUND');
      }

      const auctionData = doc.data()!;
      const sellerSnap = await db.collection('users').doc(auctionData.sellerId).get();
      
      const data = {
        ...auctionData,
        id: doc.id,
        seller: toSellerPublic(sellerSnap.id, sellerSnap.data()),
        endTime: auctionData.endTime?.toDate ? auctionData.endTime.toDate() : new Date(auctionData.endTime),
      } as AuctionWithSeller;

      return successResponse(data);
    } catch (err) {
      log.error('Failed to get auction by ID', err, { auctionId: id });
      return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred while fetching the auction');
    }
  }

  /**
   * Fetch a paginated list of auctions with filters
   */
  static async list(filters: AuctionFilters & { limit?: number; offset?: number }): Promise<ServiceResponse<{
    auctions: AuctionWithSeller[];
    total: number;
    pages: number;
    currentPage: number;
  }>> {
    try {
      const { category, status = 'ACTIVE', sortBy, sortOrder = 'desc', limit = 12, page = 1 } = filters;

      let query: FirebaseFirestore.Query = db.collection('auctions');
      
      if (status) query = query.where('status', '==', status);
      if (category && category !== 'all') query = query.where('category', '==', category);
      if (filters.location && filters.location !== 'all') query = query.where('location', '==', filters.location);

      const orderField = sortBy === 'bids' ? 'bidCount' : (sortBy || 'endTime');
      
      const [totalSnap, auctionsSnap] = await Promise.all([
        query.count().get(),
        query
          .orderBy(orderField, sortOrder)
          .limit(limit)
          .offset((page - 1) * limit)
          .get()
      ]);

      const total = totalSnap.data().count;
      const auctionDocs = snapDocs<Auction>(auctionsSnap);

      // Batch fetch sellers to avoid N+1
      const sellerIds = [...new Set(auctionDocs.map(a => a.sellerId))];
      const sellerSnaps = await Promise.all(sellerIds.map(id => db.collection('users').doc(id).get()));
      const sellerMap = new Map(sellerSnaps.map(s => [s.id, toSellerPublic(s.id, s.data())]));

      const auctions = auctionDocs.map(a => ({
        ...a,
        seller: sellerMap.get(a.sellerId)!,
        endTime: a.endTime?.toDate ? a.endTime.toDate() : new Date(a.endTime),
      })) as AuctionWithSeller[];

      return successResponse({
        auctions,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      });
    } catch (err) {
      log.error('Failed to list auctions', err, { filters });
      return errorResponse(ErrorType.INTERNAL, 'Failed to retrieve auction listings');
    }
  }

  /**
   * Create a new auction listing
   */
  static async create(input: CreateAuctionInput, userId: string): Promise<ServiceResponse<Auction>> {
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
}
