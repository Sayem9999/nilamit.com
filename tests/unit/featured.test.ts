import { describe, it, expect } from 'vitest';
import {
  FEATURED_TIERS,
  getFeaturedTier,
  quoteFeatured,
  buildFeaturedTranId,
  parseFeaturedTranId,
  isFeaturedTranId,
} from '@/services/finance/featured';

describe('featured pricing', () => {
  it('exposes a non-empty, ascending-duration tier list', () => {
    expect(FEATURED_TIERS.length).toBeGreaterThan(0);
    const days = FEATURED_TIERS.map((t) => t.days);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it('quotes a known tier and rejects unknown durations', () => {
    expect(quoteFeatured(7)).toEqual({ days: 7, priceBdt: getFeaturedTier(7)!.priceBdt });
    expect(quoteFeatured(99)).toBeNull();
    expect(quoteFeatured(0)).toBeNull();
  });
});

describe('featured tran-id codec', () => {
  const auctionId = 'AbC123dEf456GhI789Jk'; // Firestore-style auto id (alphanumeric)

  it('round-trips build → parse', () => {
    const tranId = buildFeaturedTranId(auctionId, 7, 'deadbeefcafe');
    expect(isFeaturedTranId(tranId)).toBe(true);
    expect(parseFeaturedTranId(tranId)).toEqual({ auctionId, days: 7, nonce: 'deadbeefcafe' });
  });

  it('rejects non-featured ids', () => {
    expect(isFeaturedTranId('adv-123')).toBe(false);
    expect(isFeaturedTranId(undefined)).toBe(false);
    expect(parseFeaturedTranId('adv-123')).toBeNull();
  });

  it('rejects malformed shapes and unknown tiers', () => {
    expect(parseFeaturedTranId('feat_onlyone')).toBeNull();
    expect(parseFeaturedTranId('feat_a_b_c_d_e')).toBeNull();
    // valid shape but a duration that isn't a real tier → reject (anti-forgery)
    expect(parseFeaturedTranId(`feat_${auctionId}_99_nonce`)).toBeNull();
    expect(parseFeaturedTranId(`feat_${auctionId}_notanumber_nonce`)).toBeNull();
  });
});
