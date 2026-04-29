import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeObject } from '@/lib/sanitizer';
import { filterPII, containsPII } from '@/lib/pii-filter';

describe('Security Sanitizer', () => {
  it('should strip script tags from text', () => {
    const malicious = '<script>alert("xss")</script>Hello';
    expect(sanitize(malicious)).toBe('Hello');
  });

  it('should recursively sanitize complex objects', () => {
    const input = {
      title: '<b>Awesome Item</b>',
      metadata: {
        description: '<img src=x onerror=alert(1)> description'
      },
      tags: ['<a href="javascript:void(0)">safe</a>', 'legit']
    };

    const output = sanitizeObject(input);
    expect(output.title).toBe('Awesome Item');
    expect(output.metadata.description).toBe(' description');
    expect(output.tags[0]).toBe('safe');
    expect(output.tags[1]).toBe('legit');
  });
});

describe('PII Filter — filterPII', () => {
  const REPLACEMENT = '[নিরাপত্তার স্বার্থে লুকানো]';

  it('masks Bangladeshi phone numbers', () => {
    const text = 'Call me at 01712345678 or 8801912345678';
    const filtered = filterPII(text);
    expect(filtered).toContain(REPLACEMENT);
    expect(filtered).not.toContain('01712345678');
  });

  it('masks email addresses', () => {
    const text = 'My email is test@nilamit.app';
    expect(filterPII(text)).toBe(`My email is ${REPLACEMENT}`);
  });
});

describe('PII Filter — containsPII (regression: stateful global regex)', () => {
  // Regression test for H4: BANGLADESH_PHONE_REGEX had a `g` flag.
  // Calling .test() on a global regex advances lastIndex, causing alternating
  // true/false results for identical inputs. The fix adds a separate non-global
  // regex for .test() calls (BANGLADESH_PHONE_REGEX_TEST).
  it('returns the same result on repeated calls with the same phone-containing input', () => {
    const text = 'Call 01712345678 for details';
    const results = Array.from({ length: 6 }, () => containsPII(text));
    expect(results).toEqual([true, true, true, true, true, true]);
  });

  it('returns the same result on repeated calls with a clean input', () => {
    const text = 'Brand new Samsung Galaxy S24, box never opened';
    const results = Array.from({ length: 6 }, () => containsPII(text));
    expect(results).toEqual([false, false, false, false, false, false]);
  });

  it('detects email addresses', () => {
    expect(containsPII('reach me at user@example.com')).toBe(true);
  });

  it('detects off-platform keywords', () => {
    expect(containsPII('message me on WhatsApp')).toBe(true);
  });

  it('returns false for clean auction descriptions', () => {
    expect(containsPII('Brand new Samsung Galaxy S24, box opened once')).toBe(false);
  });
});
