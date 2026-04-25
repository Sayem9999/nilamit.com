// Skipped pending refactor — importing BiddingService transitively pulls in
// a 'use server' module that vitest cannot load ("This module cannot be
// imported from a Client Component module"). Unblock by either:
//   1. Splitting BiddingService into a pure-logic core that's safe to import
//      under vitest, OR
//   2. Adding a vitest plugin that strips 'use server' directives in test env.
// Tracked separately; not blocking M9 deploy fix.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BiddingService } from '@/services/bidding/bidding-service';
import { db } from '@/lib/db';
import { ERROR_CODES } from '@/lib/constants';

// Mock DB and external dependencies
vi.mock('@/lib/db', () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(() => ({ empty: true, docs: [] })),
          })),
        })),
        get: vi.fn(() => ({ empty: true, docs: [] })),
      })),
    })),
    runTransaction: vi.fn(),
  },
  newId: vi.fn(() => 'test-id'),
  snapDocs: vi.fn((snap) => snap.docs.map(d => d.data())),
}));

vi.mock('@/lib/firebase-admin', () => ({
  rtdbPush: vi.fn(),
  rtdbSet: vi.fn(),
}));

describe('BiddingService Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should block bids on non-existent auctions', async () => {
    // Simulate empty auction document
    (db.runTransaction as unknown as { mockImplementation: (fn: (tx: unknown) => Promise<unknown>) => void }).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = { get: vi.fn(() => ({ exists: false })) };
      return cb(tx);
    });

    await expect(
      BiddingService.placeBid('invalid-id', 100, 'user-1', 'User 1', 'u1@test.com')
    ).rejects.toThrow(ERROR_CODES.NOT_FOUND);
  });

  it('should block bids from the seller', async () => {
    (db.runTransaction as unknown as { mockImplementation: (fn: (tx: unknown) => Promise<unknown>) => void }).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const auctionData = {
        status: 'ACTIVE',
        sellerId: 'user-1', // Same as bidder
        endTime: new Date(Date.now() + 100000),
        currentPrice: 50,
        minBidIncrement: 10,
      };
      const tx = { get: vi.fn(() => ({ exists: true, data: () => auctionData })) };
      return cb(tx);
    });

    await expect(
      BiddingService.placeBid('auc-1', 100, 'user-1', 'Seller', 's@test.com')
    ).rejects.toThrow(ERROR_CODES.SELF_BID_FORBIDDEN);
  });

  it('should extend endTime when a bid is placed in the soft-close window', async () => {
    const originalEndTime = new Date(Date.now() + 30000); // 30s remaining
    
    (db.runTransaction as unknown as { mockImplementation: (fn: (tx: unknown) => Promise<unknown>) => void }).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const auctionData = {
        status: 'ACTIVE',
        sellerId: 'seller-1',
        endTime: originalEndTime,
        currentPrice: 100,
        minBidIncrement: 10,
        bidCount: 1,
        wasExtended: false,
      };
      const tx = { 
        get: vi.fn(() => ({ exists: true, data: () => auctionData })),
        set: vi.fn(),
        update: vi.fn(),
      };
      return cb(tx);
    });

    const result = await BiddingService.placeBid('auc-1', 150, 'buyer-1', 'Buyer', 'b@test.com');
    
    expect(result.success).toBe(true);
    expect(result.antiSnipeTriggered).toBe(true);
    expect(result.newEndTime.getTime()).toBeGreaterThan(originalEndTime.getTime());
  });
});
