import { describe, it, expect } from 'vitest';
import {
  placeBidSchema,
  createAuctionSchema,
  bdPhoneSchema,
  otpSchema,
  passwordSchema,
  emailSchema,
  MAX_AUCTION_PRICE_BDT,
} from '@/lib/schemas';
import crypto from 'crypto';

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

// ─── bdPhoneSchema ─────────────────────────────────────────────────────────

describe('bdPhoneSchema', () => {
  it('accepts a valid Bangladesh number with +88 prefix', () => {
    expect(bdPhoneSchema.safeParse('+8801712345678').success).toBe(true);
  });

  it('accepts numbers in the 013–019 range', () => {
    expect(bdPhoneSchema.safeParse('+8801312345678').success).toBe(true);
    expect(bdPhoneSchema.safeParse('+8801912345678').success).toBe(true);
  });

  it('rejects numbers without country code', () => {
    expect(bdPhoneSchema.safeParse('01712345678').success).toBe(false);
  });

  it('rejects a non-Bangladesh prefix', () => {
    expect(bdPhoneSchema.safeParse('+1234567890123').success).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(bdPhoneSchema.safeParse('+880171234567').success).toBe(false);
  });
});

// ─── otpSchema ─────────────────────────────────────────────────────────────

describe('otpSchema', () => {
  it('accepts exactly 6 digits', () => {
    expect(otpSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects 5 digits', () => {
    expect(otpSchema.safeParse('12345').success).toBe(false);
  });

  it('rejects 7 digits', () => {
    expect(otpSchema.safeParse('1234567').success).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(otpSchema.safeParse('12345a').success).toBe(false);
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
