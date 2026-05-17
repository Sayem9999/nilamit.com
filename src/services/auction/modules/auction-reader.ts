import { db, toSellerPublic, toSellerPrivate, docData, snapDocs } from '@/lib/db';
import { Auction, AuctionFilters, AuctionWithSeller, SellerPublic, Bid, LatestActivity } from '@/types';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';

export class AuctionReader {
  /**
   * Fetch a single auction by ID with hydrated seller/winner info
   */
  static async getById(id: string, viewerId?: string | null): Promise<ServiceResponse<AuctionWithSeller>> {
    try {
      const doc = await db.collection('auctions').doc(id).get();
      if (!doc.exists) {
        return errorResponse(ErrorType.NOT_FOUND, 'Auction not found', 'AUCTION_NOT_FOUND');
      }

      const auctionData = docData<Auction>(doc)!;
      
      const userRefs = [db.collection('users').doc(auctionData.sellerId)];
      if (auctionData.winnerId) {
        userRefs.push(db.collection('users').doc(auctionData.winnerId));
      }
      
      const userSnaps = await db.getAll(...userRefs);
      const sellerSnap = userSnaps[0];
      const winnerSnap = userSnaps[1];
      
      const isSeller = viewerId === auctionData.sellerId;
      const isWinner = viewerId === auctionData.winnerId;
      const isProxyOwner = viewerId === auctionData.proxyBidderId;
      
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

      const data = {
        ...auctionData,
        id: doc.id,
        proxyMaxBid: isProxyOwner ? auctionData.proxyMaxBid : undefined,
        proxyBidderId: isProxyOwner ? auctionData.proxyBidderId : undefined,
        
        seller: (isSeller || isWinner)
          ? toSellerPrivate(sellerSnap.id, sellerSnap.data())! 
          : toSellerPublic(sellerSnap.id, sellerSnap.data())!,
        winner: winnerSnap?.exists ? { 
          id: winnerSnap.id, 
          name: (winnerSnap.data()?.name as string | undefined) || null, 
          image: (winnerSnap.data()?.image as string | undefined) || null 
        } : null,
        startTime: toDate(auctionData.startTime),
        endTime: toDate(auctionData.endTime),
        createdAt: toDate(auctionData.createdAt),
        updatedAt: toDate(auctionData.updatedAt),
        logistics: sanitizeLogistics(auctionData.logistics),
      } as unknown as AuctionWithSeller;

      return successResponse(data);
    } catch (err) {
      log.error('AuctionReader.getById failed', err, { auctionId: id });
      return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred');
    }
  }

  /**
   * Fetch a paginated list of auctions with filters
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
      if (filters.isFeatured) query = query.where('isFeatured', '==', true);
      if (category && category !== 'all') query = query.where('category', '==', category);
      if (filters.location && filters.location !== 'all') query = query.where('location', '==', filters.location);

      const ALLOWED_SORT_FIELDS = ['currentPrice', 'endTime', 'bidCount', 'createdAt', 'bids'];
      const orderField = (sortBy && ALLOWED_SORT_FIELDS.includes(sortBy)) 
        ? (sortBy === 'bids' ? 'bidCount' : sortBy) 
        : 'endTime';
      
      let auctionsQuery = query.orderBy(orderField, sortOrder);

      if (lastId) {
        const lastDoc = await db.collection('auctions').doc(lastId).get();
        if (lastDoc.exists) auctionsQuery = auctionsQuery.startAfter(lastDoc);
      }

      const [totalSnap, auctionsSnap] = await Promise.all([
        query.count().get(),
        auctionsQuery.limit(limit).get()
      ]);

      const total = totalSnap.data().count;
      const auctionDocs = snapDocs<Auction>(auctionsSnap);

      const sellerIds = [...new Set(auctionDocs.map(a => a.sellerId))];
      const sellerSnaps = sellerIds.length > 0 ? await db.getAll(...sellerIds.map(id => db.collection('users').doc(id))) : [];
      const sellerMap = new Map(sellerSnaps.map(s => [s.id, toSellerPublic(s.id, s.data())]));

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
        const rawEnd = a.endTime as unknown as { toDate?: () => Date } | Date;
        const endTime = rawEnd instanceof Date ? rawEnd : rawEnd?.toDate?.() ?? new Date(rawEnd as unknown as string);
        
        const { proxyMaxBid: _pmb, proxyBidderId: _pbi, ...safeData } = a as unknown as Record<string, unknown>;
        void _pmb; void _pbi;
        
        return {
          ...safeData,
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
      log.error('AuctionReader.list failed', err, { filters });
      return errorResponse(ErrorType.INTERNAL, 'Failed to retrieve auction listings');
    }
  }

  /**
   * Fetch specialized homepage feeds
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
          .limit(40)
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
          const createdAt = (b.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(b.createdAt as string | number | Date);
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
      log.error('AuctionReader.getSpecializedFeeds failed', error);
      return errorResponse(ErrorType.INTERNAL, 'Failed to fetch feeds');
    }
  }
}
