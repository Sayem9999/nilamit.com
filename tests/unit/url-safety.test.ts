import { describe, it, expect } from 'vitest';
import { isSafeRedirectPath, sanitizeRedirect, DEFAULT_REDIRECT } from '@/lib/url-safety';

// Open-redirect defense: any user-supplied URL that reaches router.push /
// redirect() / href must pass through this. A regression here = phishing via
// "?callbackUrl=https://evil.com".

describe('isSafeRedirectPath — accepts same-origin relative paths', () => {
  it.each(['/dashboard', '/auctions/123?tab=bids', '/profile#settings', '/'])(
    'accepts %s',
    (p) => expect(isSafeRedirectPath(p)).toBe(true),
  );
});

describe('isSafeRedirectPath — rejects unsafe input', () => {
  it.each([
    '//evil.com',            // protocol-relative
    'https://evil.com/x',    // absolute
    'http://evil.com',       // absolute
    'javascript:alert(1)',   // script URI
    'dashboard',             // no leading slash
    '/\\evil.com',           // backslash trick browsers normalize to //
    '/path with space',      // whitespace
    '/path\twith-tab',       // control char
    '',                      // empty
  ])('rejects %j', (p) => expect(isSafeRedirectPath(p)).toBe(false));

  it('rejects non-string input', () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath(123)).toBe(false);
    expect(isSafeRedirectPath({})).toBe(false);
  });
});

describe('sanitizeRedirect', () => {
  it('returns the path when safe', () => {
    expect(sanitizeRedirect('/auctions/1')).toBe('/auctions/1');
  });

  it('falls back to the default for unsafe input', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirect('//evil.com')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirect(null)).toBe(DEFAULT_REDIRECT);
  });

  it('honours a custom fallback', () => {
    expect(sanitizeRedirect('javascript:alert(1)', '/home')).toBe('/home');
  });
});
