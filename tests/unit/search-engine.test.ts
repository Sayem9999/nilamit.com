import { describe, it, expect, vi } from 'vitest';

// search-engine.ts is `server-only` and reads TYPESENSE_* env at import time.
// With no env set, isSearchEngineConfigured() is false and the network helpers
// no-op — which is exactly the "not provisioned yet" production default.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import {
  isSearchEngineConfigured,
  toSearchDoc,
  searchAuctions,
  indexAuction,
  updateAuctionInIndex,
} from '@/lib/search-engine';

describe('search-engine (unconfigured / default)', () => {
  it('reports not configured without env', () => {
    expect(isSearchEngineConfigured()).toBe(false);
  });

  it('no-ops every network export so writes never fail', async () => {
    await expect(indexAuction({ id: 'x' })).resolves.toBe(false);
    await expect(updateAuctionInIndex('x', { status: 'SOLD' })).resolves.toBe(false);
    // searchAuctions returns null → signals the reader to use the fallback scan
    await expect(searchAuctions({ query: 'iphone' })).resolves.toBeNull();
  });
});

describe('toSearchDoc projection', () => {
  it('projects a Firestore auction into the thin index doc', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-02-01T00:00:00Z');
    const doc = toSearchDoc({
      id: 'a1',
      title: 'iPhone 15',
      description: 'mint condition',
      category: 'electronics',
      location: 'Dhaka',
      condition: 'USED',
      status: 'ACTIVE',
      sellerId: 's1',
      currentPrice: 50000,
      bidCount: 3,
      isFeatured: true,
      endTime: end,
      createdAt: created,
    });
    expect(doc).toEqual({
      id: 'a1',
      title: 'iPhone 15',
      description: 'mint condition',
      category: 'electronics',
      location: 'Dhaka',
      condition: 'USED',
      status: 'ACTIVE',
      sellerId: 's1',
      currentPrice: 50000,
      bidCount: 3,
      isFeatured: true,
      endTime: Math.floor(end.getTime() / 1000),
      createdAt: Math.floor(created.getTime() / 1000),
    });
  });

  it('coerces Firestore Timestamp-like values and missing fields', () => {
    const doc = toSearchDoc({
      id: 'a2',
      title: 'thing',
      endTime: { toDate: () => new Date('2026-03-01T00:00:00Z') },
      // currentPrice/bidCount/location absent → defaulted
    });
    expect(doc.currentPrice).toBe(0);
    expect(doc.bidCount).toBe(0);
    expect(doc.location).toBe('');
    expect(doc.isFeatured).toBe(false);
    expect(doc.endTime).toBe(Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000));
  });
});
