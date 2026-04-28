import { describe, it, expect } from 'vitest';
import { validateBidPreconditions, computeAntiSnipeExtension } from '@/services/bidding/bid-rules';
import { ERROR_CODES, SOFT_CLOSE_WINDOW_MS, SOFT_CLOSE_EXTENSION_MS } from '@/lib/constants';

const baseInput = {
  auctionStatus: 'ACTIVE',
  sellerId: 'seller-1',
  bidderId: 'buyer-1',
  currentPrice: 100,
  startingPrice: 50,
  minBidIncrement: 10,
  amount: 150,
  endTime: new Date(Date.now() + 60 * 60 * 1000),
  now: new Date(),
};

describe('validateBidPreconditions', () => {
  it('accepts a valid bid above the minimum increment', () => {
    expect(() => validateBidPreconditions(baseInput)).not.toThrow();
    expect(validateBidPreconditions(baseInput).minRequired).toBe(110);
  });

  it('rejects bids on inactive auctions', () => {
    expect(() => validateBidPreconditions({ ...baseInput, auctionStatus: 'PENDING' }))
      .toThrow(ERROR_CODES.AUCTION_NOT_ACTIVE);
  });

  it('rejects bids after auction end time', () => {
    expect(() => validateBidPreconditions({
      ...baseInput,
      endTime: new Date(baseInput.now.getTime() - 1000),
    })).toThrow(ERROR_CODES.AUCTION_ENDED);
  });

  it('rejects bids from the seller', () => {
    expect(() => validateBidPreconditions({ ...baseInput, bidderId: baseInput.sellerId }))
      .toThrow(ERROR_CODES.SELF_BID_FORBIDDEN);
  });

  it('rejects bids below the minimum increment', () => {
    expect(() => validateBidPreconditions({ ...baseInput, amount: 105 }))
      .toThrow(/BID_TOO_LOW/);
  });

  it('falls back to startingPrice when currentPrice is undefined', () => {
    const result = validateBidPreconditions({
      ...baseInput,
      currentPrice: undefined,
      startingPrice: 200,
      amount: 215,
    });
    expect(result.minRequired).toBe(210);
  });

  it('defaults minBidIncrement to 10 when undefined', () => {
    const result = validateBidPreconditions({
      ...baseInput,
      minBidIncrement: undefined,
    });
    expect(result.minRequired).toBe(110);
  });
});

describe('computeAntiSnipeExtension', () => {
  it('does not extend when bid is outside the soft-close window', () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + SOFT_CLOSE_WINDOW_MS + 1000);
    const result = computeAntiSnipeExtension({ endTime, now });

    expect(result.triggered).toBe(false);
    expect(result.newEndTime.getTime()).toBe(endTime.getTime());
  });

  it('extends endTime when bid lands inside the soft-close window', () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 30 * 1000); // 30s remaining
    const result = computeAntiSnipeExtension({ endTime, now });

    expect(result.triggered).toBe(true);
    expect(result.newEndTime.getTime()).toBe(endTime.getTime() + SOFT_CLOSE_EXTENSION_MS);
  });

  it('extends from endTime, not now (cannot shorten the auction)', () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + SOFT_CLOSE_WINDOW_MS); // exactly at window edge
    const result = computeAntiSnipeExtension({ endTime, now });

    expect(result.triggered).toBe(true);
    expect(result.newEndTime.getTime()).toBe(endTime.getTime() + SOFT_CLOSE_EXTENSION_MS);
    expect(result.newEndTime.getTime()).toBeGreaterThan(now.getTime() + SOFT_CLOSE_EXTENSION_MS);
  });
});
