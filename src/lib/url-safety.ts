/**
 * URL safety utilities.
 *
 * Used to defend against open-redirect attacks. Any URL that originates from
 * user input (query string, form field, postMessage, etc.) and is later passed
 * to `router.push`, `redirect()`, `Response.redirect`, or any anchor `href` MUST
 * be run through `sanitizeRedirect()` first.
 *
 * Policy: only same-origin paths are allowed. We accept relative paths starting
 * with a single slash and reject everything else (protocol-relative `//evil.com`,
 * absolute `https://evil.com`, `javascript:` URIs, fragments-only, etc.).
 */

/** Default fallback when an untrusted URL is rejected. */
export const DEFAULT_REDIRECT = '/dashboard';

/**
 * Returns true when `url` is a safe same-origin relative path.
 *
 * Examples of accepted values:
 *   "/dashboard"
 *   "/auctions/123?tab=bids"
 *   "/profile#settings"
 *
 * Rejected:
 *   "//evil.com"            (protocol-relative)
 *   "https://evil.com/x"    (absolute)
 *   "javascript:alert(1)"   (script URI)
 *   ""                      (empty)
 *   "dashboard"             (no leading slash)
 */
export function isSafeRedirectPath(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false;

  // Must start with a single forward slash and not be protocol-relative.
  if (!url.startsWith('/') || url.startsWith('//')) return false;

  // Reject backslash tricks that some browsers normalize to "/" (e.g. "/\evil.com").
  if (url.startsWith('/\\')) return false;

  // Reject control characters and whitespace that could confuse parsers.
   
  if (/[\x00-\x1f\x7f\s]/.test(url)) return false;

  return true;
}

/**
 * Returns `url` if safe, otherwise the supplied fallback.
 * Callers should always use this rather than trusting raw query parameters.
 */
export function sanitizeRedirect(
  url: unknown,
  fallback: string = DEFAULT_REDIRECT,
): string {
  return isSafeRedirectPath(url) ? url : fallback;
}
