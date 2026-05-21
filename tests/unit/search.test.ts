import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define the mock docs that we can manipulate inside tests
let mockAuctions: Record<string, unknown>[] = [];
let mockWatchlistDocs: Record<string, unknown>[] = [];

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => {
  const mockCollection = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation(async () => ({
        data: () => ({ count: mockAuctions.length })
      }))
    }),
    get: vi.fn().mockImplementation(async () => {
      return {
        docs: mockAuctions.map(d => ({
          id: d.id as string,
          data: () => d
        })),
        empty: mockAuctions.length === 0
      };
    }),
    doc: vi.fn().mockImplementation((id: string) => ({
      id,
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ name: 'Test User', image: 'avatar.png' })
      })
    }))
  };

  const mockDb = {
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn().mockImplementation((userId: string) => ({
            id: userId,
            collection: vi.fn().mockImplementation((sub: string) => {
              if (sub === 'watchlist') {
                return {
                  where: vi.fn().mockReturnThis(),
                  get: vi.fn().mockResolvedValue({
                    docs: mockWatchlistDocs.map(w => ({
                      data: () => w
                    }))
                  })
                };
              }
              return {};
            })
          }))
        };
      }
      return mockCollection;
    }),
    getAll: vi.fn().mockImplementation(async (...refs: { id: string }[]) => {
      return refs.map(ref => ({
        id: ref.id,
        exists: true,
        data: () => ({ name: 'Test User', image: 'avatar.png' })
      }));
    }),
    runTransaction: vi.fn(),
  };

  return {
    db: mockDb,
    toSellerPublic: vi.fn().mockImplementation((id: string, data: Record<string, unknown> | undefined) => ({
      id,
      name: (data?.name as string) || 'Mock Seller',
      image: (data?.image as string) || null,
      rating: 5,
      ratingCount: 1,
      isVerifiedSeller: true,
      isRetailer: false,
      isTopRated: true,
    })),
    toSellerPrivate: vi.fn().mockImplementation((id: string, data: Record<string, unknown> | undefined) => ({
      id,
      name: (data?.name as string) || 'Mock Seller',
      image: (data?.image as string) || null,
      rating: 5,
      ratingCount: 1,
      isVerifiedSeller: true,
      isRetailer: false,
      isTopRated: true,
    })),
    snapDocs: vi.fn().mockImplementation((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }))),
    toDate: (val: unknown) => (val instanceof Date ? val : new Date(val as string | number)),
  };
});

import { AuctionReader } from '@/services/auction/modules/auction-reader';
import { db } from '@/lib/db';

describe('AuctionReader.list - Hybrid Search Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuctions = [
      {
        id: 'auc-1',
        title: '4k Samsung 75 inch tv',
        description: 'Amazing brand new smart TV.',
        category: 'electronics',
        status: 'ACTIVE',
        sellerId: 'seller-1',
        currentPrice: 50000,
        endTime: new Date('2026-12-31T23:59:59Z'),
        createdAt: new Date('2026-05-01T12:00:00Z'),
        bidCount: 3,
      },
      {
        id: 'auc-2',
        title: 'E2E Test: Vintage Camera',
        description: 'Rare collectible camera.',
        category: 'electronics',
        status: 'ACTIVE',
        sellerId: 'seller-2',
        currentPrice: 5000,
        endTime: new Date('2026-11-30T23:59:59Z'),
        createdAt: new Date('2026-05-10T12:00:00Z'),
        bidCount: 0,
      },
      {
        id: 'auc-3',
        title: 'Apple TV HD',
        description: 'Stream all your favorites in high definition.',
        category: 'electronics',
        status: 'ACTIVE',
        sellerId: 'seller-1',
        currentPrice: 12000,
        endTime: new Date('2026-10-31T23:59:59Z'),
        createdAt: new Date('2026-05-05T12:00:00Z'),
        bidCount: 1,
      }
    ];
    mockWatchlistDocs = [];
  });

  it('filters auctions case-insensitively by title and description matching the query', async () => {
    const result = await AuctionReader.list({ search: 'tv', limit: 12 });
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.total).toBe(2);
      expect(result.data.auctions).toHaveLength(2);
      
      const titles = result.data.auctions.map(a => a.title);
      expect(titles).toContain('4k Samsung 75 inch tv');
      expect(titles).toContain('Apple TV HD');
      expect(titles).not.toContain('E2E Test: Vintage Camera');
    }
  });

  it('supports sorting the matching results in-memory', async () => {
    // Sort by currentPrice desc
    const resDesc = await AuctionReader.list({ search: 'tv', sortBy: 'currentPrice', sortOrder: 'desc', limit: 12 });
    expect(resDesc.success).toBe(true);
    if (resDesc.success && resDesc.data) {
      expect(resDesc.data.auctions[0].id).toBe('auc-1'); // 50000
      expect(resDesc.data.auctions[1].id).toBe('auc-3'); // 12000
    }

    // Sort by currentPrice asc
    const resAsc = await AuctionReader.list({ search: 'tv', sortBy: 'currentPrice', sortOrder: 'asc', limit: 12 });
    expect(resAsc.success).toBe(true);
    if (resAsc.success && resAsc.data) {
      expect(resAsc.data.auctions[0].id).toBe('auc-3'); // 12000
      expect(resAsc.data.auctions[1].id).toBe('auc-1'); // 50000
    }
  });

  it('supports pagination using limit and lastId in-memory', async () => {
    // Limit to 1
    const res1 = await AuctionReader.list({ search: 'tv', sortBy: 'currentPrice', sortOrder: 'desc', limit: 1 });
    expect(res1.success).toBe(true);
    if (res1.success && res1.data) {
      expect(res1.data.auctions).toHaveLength(1);
      expect(res1.data.auctions[0].id).toBe('auc-1');
      expect(res1.data.lastId).toBe('auc-1');
      expect(res1.data.total).toBe(2);

      // Fetch next page starting after auc-1
      const res2 = await AuctionReader.list({ search: 'tv', sortBy: 'currentPrice', sortOrder: 'desc', limit: 1, lastId: 'auc-1' });
      expect(res2.success).toBe(true);
      if (res2.success && res2.data) {
        expect(res2.data.auctions).toHaveLength(1);
        expect(res2.data.auctions[0].id).toBe('auc-3');
        expect(res2.data.lastId).toBe('auc-3');
      }
    }
  });

  it('hydrates seller profiles and watchlist status only for the sliced page', async () => {
    mockWatchlistDocs = [{ auctionId: 'auc-3', userId: 'user-viewer' }];
    const result = await AuctionReader.list({ search: 'tv', limit: 12, viewerId: 'user-viewer' });
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      const tv = result.data.auctions.find(a => a.id === 'auc-1');
      const appleTv = result.data.auctions.find(a => a.id === 'auc-3');

      expect(tv?.seller).toBeDefined();
      expect(appleTv?.seller).toBeDefined();
      expect(tv?.isWatchlisted).toBe(false);
      expect(appleTv?.isWatchlisted).toBe(true);
    }
  });

  it('falls back to direct Firestore-level querying when search filter is not present', async () => {
    // Standard list query
    const result = await AuctionReader.list({ category: 'electronics', limit: 12 });
    expect(result.success).toBe(true);

    // Verify db.collection is called for 'auctions'
    expect(db.collection).toHaveBeenCalledWith('auctions');
  });
});
