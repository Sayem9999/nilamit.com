import { describe, it, expect } from 'vitest';
import {
  placeBidSchema,
  createAuctionSchema,
  passwordSchema,
  emailSchema,
  MAX_AUCTION_PRICE_BDT,
  systemConfigUpdateSchema,
} from '@/lib/schemas';
import crypto from 'crypto';

// ─── systemConfigUpdateSchema ───────────────────────────────────────────────

describe('systemConfigUpdateSchema', () => {
  it('accepts valid 11-digit bKash/Nagad treasury numbers', () => {
    const r = systemConfigUpdateSchema.safeParse({
      treasuryBkash: '01712345678',
      treasuryNagad: '01812345678',
    });
    expect(r.success).toBe(true);
  });

  it('rejects malformed treasury numbers (payment-destination safety)', () => {
    expect(systemConfigUpdateSchema.safeParse({ treasuryBkash: '12345' }).success).toBe(false);
    expect(systemConfigUpdateSchema.safeParse({ treasuryBkash: '02712345678' }).success).toBe(false); // bad prefix
    expect(systemConfigUpdateSchema.safeParse({ treasuryBkash: '0171234567' }).success).toBe(false);  // 10 digits
    expect(systemConfigUpdateSchema.safeParse({ treasuryBkash: '017123456789' }).success).toBe(false); // 12 digits
    expect(systemConfigUpdateSchema.safeParse({ treasuryNagad: '0171234567a' }).success).toBe(false);  // non-digit
  });

  it('allows an empty treasury string (clearing the number)', () => {
    expect(systemConfigUpdateSchema.safeParse({ treasuryBkash: '' }).success).toBe(true);
  });

  it('strips unknown keys so a crafted payload cannot mass-assign', () => {
    const r = systemConfigUpdateSchema.safeParse({
      heroTitle: 'Hi',
      isAdmin: true,
      id: 'evil',
      maintenanceMode: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ heroTitle: 'Hi' });
    }
  });

  it('enforces percentage bounds (0–100) and allows null tiers', () => {
    expect(systemConfigUpdateSchema.safeParse({ commissionPercentage: 50 }).success).toBe(true);
    expect(systemConfigUpdateSchema.safeParse({ commissionPercentage: null }).success).toBe(true);
    expect(systemConfigUpdateSchema.safeParse({ commissionPercentage: 101 }).success).toBe(false);
    expect(systemConfigUpdateSchema.safeParse({ hybridCommitmentPercentage: -1 }).success).toBe(false);
  });
});

// ─── placeBidSchema ────────────────────────────────────────────────────────

describe('placeBidSchema', () => {
  it('accepts a valid bid', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'abc123', amount: 500 });
    expect(result.success).toBe(true);
  });

  it('rejects a negative amount', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'abc', amount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a zero amount', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'abc', amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects amount above the price ceiling', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'abc', amount: MAX_AUCTION_PRICE_BDT + 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a fractional amount (must be integer taka)', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'abc', amount: 100.5 });
    expect(result.success).toBe(false);
  });

  it('rejects an empty auctionId', () => {
    const result = placeBidSchema.safeParse({ auctionId: '', amount: 500 });
    expect(result.success).toBe(false);
  });

  it('rejects an auctionId longer than 128 chars', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'a'.repeat(129), amount: 500 });
    expect(result.success).toBe(false);
  });

  it('accepts the maximum allowed price', () => {
    const result = placeBidSchema.safeParse({ auctionId: 'abc', amount: MAX_AUCTION_PRICE_BDT });
    expect(result.success).toBe(true);
  });
});

// ─── createAuctionSchema ───────────────────────────────────────────────────

describe('createAuctionSchema — temporal rules', () => {
  const future = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

  const valid = {
    title: 'Samsung Galaxy S24',
    description: 'Brand new in box, never used.',
    images: ['https://example.com/img.jpg'],
    category: 'electronics',
    startingPrice: 10000,
    startTime: future(60_000),
    endTime: future(3_600_000),
  };

  it('accepts a valid auction', () => {
    expect(createAuctionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects endTime before startTime', () => {
    const r = createAuctionSchema.safeParse({ ...valid, endTime: future(30_000) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.endTime).toBeDefined();
  });

  it('rejects endTime in the past', () => {
    const r = createAuctionSchema.safeParse({ ...valid, endTime: new Date(Date.now() - 120_000).toISOString() });
    expect(r.success).toBe(false);
  });

  it('rejects reservePrice below startingPrice', () => {
    const r = createAuctionSchema.safeParse({ ...valid, reservePrice: 5000 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.reservePrice).toBeDefined();
  });

  it('rejects buyItNowPrice equal to startingPrice', () => {
    const r = createAuctionSchema.safeParse({ ...valid, buyItNowPrice: valid.startingPrice });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.buyItNowPrice).toBeDefined();
  });

  it('accepts buyItNowPrice strictly above startingPrice', () => {
    expect(createAuctionSchema.safeParse({ ...valid, buyItNowPrice: valid.startingPrice + 1 }).success).toBe(true);
  });

  it('requires at least one image', () => {
    const r = createAuctionSchema.safeParse({ ...valid, images: [] });
    expect(r.success).toBe(false);
  });

  it('rejects more than 10 images', () => {
    const r = createAuctionSchema.safeParse({ ...valid, images: Array(11).fill('https://x.com/a.jpg') });
    expect(r.success).toBe(false);
  });
});



// ─── OTP generation (regression: C2 — was Math.random(), now crypto.randomInt) ─

describe('OTP generation range — crypto.randomInt', () => {
  // The generateOTP() function in phone.ts is private, so we test the
  // underlying primitive directly. This regression test ensures the generator
  // always produces a 6-digit code in [100000, 999999].
  it('crypto.randomInt(100_000, 1_000_000) always produces a 6-digit integer', () => {
    for (let i = 0; i < 1000; i++) {
      const otp = crypto.randomInt(100_000, 1_000_000);
      expect(otp).toBeGreaterThanOrEqual(100_000);
      expect(otp).toBeLessThanOrEqual(999_999);
      expect(Number.isInteger(otp)).toBe(true);
      expect(String(otp)).toHaveLength(6);
    }
  });
});

// ─── passwordSchema ────────────────────────────────────────────────────────

describe('passwordSchema', () => {
  it('accepts 8-char password', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(true);
  });

  it('accepts 128-char password (bcrypt ceiling)', () => {
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
  });

  it('rejects 7-char password', () => {
    expect(passwordSchema.safeParse('abcdefg').success).toBe(false);
  });

  it('rejects 129-char password (over bcrypt ceiling)', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});

// ─── emailSchema ───────────────────────────────────────────────────────────

describe('emailSchema', () => {
  it('lowercases the email', () => {
    const result = emailSchema.safeParse('USER@EXAMPLE.COM');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com');
  });

  it('trims whitespace', () => {
    const result = emailSchema.safeParse('  user@example.com  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com');
  });

  it('rejects invalid email format', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects emails over 254 chars', () => {
    const local = 'a'.repeat(250);
    expect(emailSchema.safeParse(`${local}@x.co`).success).toBe(false);
  });
});
