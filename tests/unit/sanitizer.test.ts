import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeObject } from '@/lib/sanitizer';
import { filterPII } from '@/lib/pii-filter';

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

describe('PII Filter', () => {
  // The PII filter intentionally emits a Bangla replacement string so users
  // see the masking notice in the marketplace's primary language.
  // Source of truth: REPLACEMENT_TEXT in src/lib/pii-filter.ts.
  const REPLACEMENT = '[নিরাপত্তার স্বার্থে লুকানো]';

  it('should mask Bangladeshi phone numbers', () => {
    const text = 'Call me at 01712345678 or 8801912345678';
    const filtered = filterPII(text);
    expect(filtered).toContain(REPLACEMENT);
    expect(filtered).not.toContain('01712345678');
  });

  it('should mask email addresses', () => {
    const text = 'My email is test@nilamit.app';
    expect(filterPII(text)).toBe(`My email is ${REPLACEMENT}`);
  });
});
