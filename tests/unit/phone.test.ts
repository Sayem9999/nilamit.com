import { describe, it, expect } from 'vitest';
import { normalizeBdPhone, maskPhone } from '@/lib/phone';

describe('normalizeBdPhone', () => {
  it('normalizes the common BD input shapes to E.164', () => {
    expect(normalizeBdPhone('01712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('8801712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('+8801712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('1712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('+880 1712-345 678')).toBe('+8801712345678');
  });

  it('accepts all real BD operator prefixes (013-019)', () => {
    for (const op of ['13', '14', '15', '16', '17', '18', '19']) {
      expect(normalizeBdPhone(`0${op}12345678`)).toBe(`+880${op}12345678`);
    }
  });

  it('rejects invalid numbers', () => {
    expect(normalizeBdPhone('')).toBeNull();
    expect(normalizeBdPhone('0123456789')).toBeNull();   // 012 isn't a BD operator
    expect(normalizeBdPhone('017123456')).toBeNull();     // too short
    expect(normalizeBdPhone('017123456789')).toBeNull();  // too long
    expect(normalizeBdPhone('+14155551234')).toBeNull();  // non-BD
    expect(normalizeBdPhone('not a number')).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks the middle, keeps prefix and last 3', () => {
    expect(maskPhone('+8801712345678')).toBe('+88017•••••678');
  });
});
