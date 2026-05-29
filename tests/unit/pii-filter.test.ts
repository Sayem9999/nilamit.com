import { describe, it, expect } from 'vitest';
import { filterPII, containsPII } from '@/lib/pii-filter';

// These functions are a core safety control — they stop sellers/buyers from
// leaking phone numbers / emails / "call me on whatsapp" into public listings
// and chat to circumvent the platform's escrow. Lock the behaviour down.

describe('filterPII', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(filterPII(null)).toBe('');
    expect(filterPII(undefined)).toBe('');
    expect(filterPII('')).toBe('');
  });

  it('masks a standard Bangladeshi mobile number', () => {
    const out = filterPII('Call me at 01712345678 today');
    expect(out).not.toContain('01712345678');
    expect(out).not.toBe('Call me at 01712345678 today');
  });

  it('masks a phone number with spacers/dashes', () => {
    const out = filterPII('ph: 017-1234-5678');
    expect(out).not.toMatch(/\d{4}-\d{4}/);
    expect(out).not.toContain('5678');
  });

  it('masks Bangla-digit phone numbers', () => {
    const out = filterPII('০১৭১২৩৪৫৬৭৮');
    expect(out).not.toContain('০১৭১২৩৪৫৬৭৮');
  });

  it('masks a standard email address', () => {
    const out = filterPII('reach me at seller@example.com');
    expect(out).not.toContain('seller@example.com');
  });

  it('masks obfuscated emails (at / dot)', () => {
    const out = filterPII('john [at] gmail [dot] com');
    expect(out).not.toContain('gmail');
  });

  it('masks off-platform contact keywords', () => {
    expect(filterPII('message me on whatsapp')).not.toContain('whatsapp');
    expect(filterPII('contact directly')).not.toContain('contact');
  });

  it('masks phonetic word-digit bypasses', () => {
    const out = filterPII('my number is ek dui tin char');
    expect(out).not.toContain('ek');
    expect(out).not.toContain('dui');
  });

  it('leaves a clean product description untouched', () => {
    const clean = 'Genuine leather wallet, barely used, includes original box';
    expect(filterPII(clean)).toBe(clean);
  });
});

describe('containsPII', () => {
  it('detects phone numbers (English + Bangla digits)', () => {
    expect(containsPII('01712345678')).toBe(true);
    expect(containsPII('০১৭১২৩৪৫৬৭৮')).toBe(true);
  });

  it('detects emails (standard + obfuscated)', () => {
    expect(containsPII('seller@example.com')).toBe(true);
    expect(containsPII('john [at] gmail [dot] com')).toBe(true);
  });

  it('detects contact keywords and word-digits', () => {
    expect(containsPII('contact me')).toBe(true);
    expect(containsPII('ek dui tin')).toBe(true);
  });

  it('returns false for clean text', () => {
    expect(containsPII('Beautiful vintage camera in working order')).toBe(false);
  });

  it('is stable across repeated calls (no stateful-regex false negatives)', () => {
    // BYPASS_KEYWORDS uses global regexes; containsPII must reset lastIndex.
    expect(containsPII('whatsapp')).toBe(true);
    expect(containsPII('whatsapp')).toBe(true);
    expect(containsPII('whatsapp')).toBe(true);
  });
});
