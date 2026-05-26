import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockCollection = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      collection: (name: string) => mockCollection(name),
      runTransaction: vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ rating: 4.5, defectCount: 2 }),
          }),
          update: mockUpdate,
        };
        return callback(mockTx);
      }),
    },
  };
});

import { ShillDetectorService } from '@/services/security/shill-detector';
import { Auction, Bid } from '@/types';

describe('ShillDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects direct IP and User-Agent overlap between seller and bidder', async () => {
    const mockUserGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ lastActiveIp: '198.51.100.42', lastActiveUserAgent: 'chrome-mac' }),
    });

    const mockBidsGet = vi.fn().mockResolvedValue({
      docs: [],
    });

    const mockAuctionsGet = vi.fn().mockResolvedValue({
      docs: [],
    });

    mockCollection.mockImplementation((name) => {
      if (name === 'users') {
        return {
          doc: () => ({ get: mockUserGet }),
        };
      }
      if (name === 'bids') {
        return {
          where: () => ({
            orderBy: () => ({ limit: () => ({ get: mockBidsGet }) }),
            limit: () => ({ get: mockBidsGet }),
          }),
        };
      }
      if (name === 'auctions') {
        return {
          where: () => ({ limit: () => ({ get: mockAuctionsGet }) }),
        };
      }
      if (name === 'reports') {
        return {
          doc: () => ({ set: mockSet }),
        };
      }
      return {};
    });

    const auction = { id: 'auc-123', sellerId: 'seller-abc' } as Auction;
    const bid = { id: 'bid-999', bidderId: 'bidder-xyz', ip: '198.51.100.42', userAgent: 'chrome-mac' } as Bid;

    const result = await ShillDetectorService.detectShillBidding(auction, bid);

    expect(result.isShill).toBe(true);
    expect(result.score).toBe(1.0); // 0.6 IP + 0.4 UA
    expect(mockSet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(expect.any(Object), {
      rating: 3.5,
      defectCount: 3,
      updatedAt: expect.any(Date),
    });
  });

  it('detects ring bidding / co-bidding from the same IP and UA', async () => {
    const mockUserGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ lastActiveIp: '203.0.113.1', lastActiveUserAgent: 'safari-ios' }),
    });

    const mockBidsGet = vi.fn().mockResolvedValue({
      docs: [
        { data: () => ({ bidderId: 'bidder-other', ip: '198.51.100.99', userAgent: 'chrome-windows' }) },
      ],
    });

    mockCollection.mockImplementation((name) => {
      if (name === 'users') {
        return {
          doc: () => ({ get: mockUserGet }),
        };
      }
      if (name === 'bids') {
        return {
          where: () => ({
            orderBy: () => ({ limit: () => ({ get: mockBidsGet }) }),
          }),
        };
      }
      if (name === 'auctions') {
        return {
          where: () => ({ limit: () => ({ get: vi.fn().mockResolvedValue({ docs: [] }) }) }),
        };
      }
      if (name === 'reports') {
        return {
          doc: () => ({ set: mockSet }),
        };
      }
      return {};
    });

    const auction = { id: 'auc-123', sellerId: 'seller-abc' } as Auction;
    const bid = { id: 'bid-999', bidderId: 'bidder-xyz', ip: '198.51.100.99', userAgent: 'chrome-windows' } as Bid;

    const result = await ShillDetectorService.detectShillBidding(auction, bid);

    expect(result.isShill).toBe(true);
    expect(result.score).toBe(0.8); // 0.5 Co-bidding IP + 0.3 Device UA
  });

  it('returns isShill = false for safe transactions', async () => {
    const mockUserGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ lastActiveIp: '203.0.113.1', lastActiveUserAgent: 'safari-ios' }),
    });

    mockCollection.mockImplementation((name) => {
      if (name === 'users') {
        return {
          doc: () => ({ get: mockUserGet }),
        };
      }
      if (name === 'bids') {
        return {
          where: () => ({
            orderBy: () => ({ limit: () => ({ get: vi.fn().mockResolvedValue({ docs: [] }) }) }),
            limit: () => ({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
          }),
        };
      }
      if (name === 'auctions') {
        return {
          where: () => ({ limit: () => ({ get: vi.fn().mockResolvedValue({ docs: [] }) }) }),
        };
      }
      return {};
    });

    const auction = { id: 'auc-123', sellerId: 'seller-abc' } as Auction;
    const bid = { id: 'bid-999', bidderId: 'bidder-xyz', ip: '198.51.100.99', userAgent: 'chrome-windows' } as Bid;

    const result = await ShillDetectorService.detectShillBidding(auction, bid);

    expect(result.isShill).toBe(false);
    expect(result.score).toBe(0);
  });
});
