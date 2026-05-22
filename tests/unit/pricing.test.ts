import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mock docs that we can manipulate inside tests
let mockAuctions: Record<string, unknown>[] = [];

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => {
  const mockCollection = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockImplementation(async () => {
      return {
        docs: mockAuctions.map(d => ({
          id: d.id as string,
          data: () => d
        })),
        empty: mockAuctions.length === 0
      };
    })
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
  };

  return {
    db: mockDb,
  };
});

import { PricingService } from '@/services/pricing/pricing-service';
import { db } from '@/lib/db';

describe('PricingService — Optimal Smart Pricing Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuctions = [];
  });

  it('returns fallback defaults when no historical auctions exist in the category', async () => {
    const res = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'NEW',
      title: 'iPhone 15'
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    if (res.data) {
      expect(res.data.dataPoints).toBe(0);
      expect(res.data.demandLevel).toBe('MODERATE');
      expect(res.data.confidence).toBe('LOW');
      expect(res.data.suggestedStart).toBe(1500); // 3000 * 1.0 * 0.5
      expect(res.data.suggestedBuyNow).toBe(3900); // 3000 * 1.0 * 1.3
    }
  });

  it('filters and ranks auctions based on keyword overlap', async () => {
    mockAuctions = [
      {
        id: '1',
        title: 'iPhone 15 Pro Max Black 256GB',
        startingPrice: 100000,
        currentPrice: 120000,
        condition: 'NEW',
        bidCount: 8,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '2',
        title: 'Samsung Galaxy S24 Ultra',
        startingPrice: 90000,
        currentPrice: 110000,
        condition: 'NEW',
        bidCount: 5,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '3',
        title: 'iPhone 15 Pro Blue 128GB',
        startingPrice: 95000,
        currentPrice: 105000,
        condition: 'NEW',
        bidCount: 7,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '4',
        title: 'iPhone 15 Used Good Condition',
        startingPrice: 60000,
        currentPrice: 75000,
        condition: 'USED',
        bidCount: 6,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '5',
        title: 'Sony WH-1000XM4 Headphones',
        startingPrice: 20000,
        currentPrice: 25000,
        condition: 'USED',
        bidCount: 3,
        status: 'SOLD',
        category: 'electronics'
      }
    ];

    const res = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'NEW',
      title: 'iPhone 15 Pro Max'
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    if (res.data) {
      expect(res.data.dataPoints).toBe(3); // 'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Used'
      expect(res.data.confidence).toBe('MEDIUM');
    }
  });

  it('applies condition multipliers correctly when target condition is USED and history has NEW and USED items', async () => {
    mockAuctions = [
      {
        id: '1',
        title: 'Standard Laptop',
        startingPrice: 10000,
        currentPrice: 10000,
        condition: 'NEW',
        bidCount: 4,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '2',
        title: 'Standard Laptop',
        startingPrice: 7000,
        currentPrice: 7000,
        condition: 'USED',
        bidCount: 4,
        status: 'SOLD',
        category: 'electronics'
      }
    ];

    const res = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'USED', // factor 0.70
      title: 'Standard Laptop'
    });

    expect(res.success).toBe(true);
    if (res.data) {
      // Item 1: NEW (1.0). Target is USED (0.7). Multiplier = 0.7/1.0 = 0.7. Normalized starting = 7000, current = 7000
      // Item 2: USED (0.7). Target is USED (0.7). Multiplier = 0.7/0.7 = 1.0. Normalized starting = 7000, current = 7000
      // Averages: starting = 7000, current = 7000. Demand: MODERATE (average bids = 4).
      // suggestedStart = avgStartingPrice * 0.80 = 5600
      // expectedFinal = avgSoldPrice = 7000
      // suggestedBuyNow = avgSoldPrice * 1.25 = 8750
      expect(res.data.suggestedStart).toBe(5600);
      expect(res.data.expectedFinal).toBe(7000);
      expect(res.data.suggestedBuyNow).toBe(8750);
    }
  });

  it('determines high demand and low demand correctly based on bid volume', async () => {
    mockAuctions = [
      {
        id: '1',
        title: 'Phone',
        startingPrice: 1000,
        currentPrice: 1000,
        condition: 'NEW',
        bidCount: 7,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '2',
        title: 'Phone',
        startingPrice: 1000,
        currentPrice: 1000,
        condition: 'NEW',
        bidCount: 8,
        status: 'SOLD',
        category: 'electronics'
      },
      {
        id: '3',
        title: 'Phone',
        startingPrice: 1000,
        currentPrice: 1000,
        condition: 'NEW',
        bidCount: 9,
        status: 'SOLD',
        category: 'electronics'
      }
    ];

    const resHigh = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'NEW',
      title: 'Phone'
    });

    expect(resHigh.data?.demandLevel).toBe('HIGH');
    expect(resHigh.data?.suggestedStart).toBe(900); // 1000 * 0.9
    expect(resHigh.data?.suggestedBuyNow).toBe(1350); // 1000 * 1.35

    mockAuctions = mockAuctions.map(a => ({ ...a, bidCount: 1 }));
    const resLow = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'NEW',
      title: 'Phone'
    });

    expect(resLow.data?.demandLevel).toBe('LOW');
    expect(resLow.data?.suggestedStart).toBe(700); // 1000 * 0.7
    expect(resLow.data?.suggestedBuyNow).toBe(1150); // 1000 * 1.15
  });

  it('enforces sanity constraints (buy-now price is at least 1.5x starting price)', async () => {
    mockAuctions = [
      {
        id: '1',
        title: 'Cheap Item',
        startingPrice: 1000,
        currentPrice: 800,
        condition: 'NEW',
        bidCount: 1,
        status: 'SOLD',
        category: 'electronics'
      }
    ];

    const res = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'NEW',
      title: 'Cheap Item'
    });

    expect(res.data?.suggestedStart).toBe(700); // 1000 * 0.7
    expect(res.data?.suggestedBuyNow).toBe(1050); // 700 * 1.5 (instead of 800 * 1.15 = 920)
  });

  it('returns an internal error response if db.collection query throws', async () => {
    vi.spyOn(db, 'collection').mockImplementationOnce(() => {
      throw new Error('Firestore connection lost');
    });

    const res = await PricingService.getSmartPricing({
      category: 'electronics',
      condition: 'NEW',
      title: 'Phone'
    });

    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('An error occurred');
  });
});
