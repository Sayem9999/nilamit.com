/**
 * Shared Sentry beforeSend / beforeBreadcrumb scrubbers.
 *
 * Sentry events leak PII surprisingly easily — Next.js puts query strings
 * into transaction names, error messages can include user input (bcrypt
 * comparing against a raw password, fetch URLs with `?token=…`), and the
 * default request integration captures cookies + headers. We strip
 * aggressively and prefer false negatives over false positives.
 *
 * Used by sentry.{server,client,edge}.config.ts.
 */

import type { ErrorEvent, EventHint, Breadcrumb } from '@sentry/nextjs';

/** Query/form keys whose values should be replaced with [REDACTED]. */
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'session',
  'otp',
  'code',
  'pin',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'email',
  'phone',
  'mobile',
]);

/** Patterns we replace inline anywhere they appear in strings. */
const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // Email addresses
  { re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[email]' },
  // Bangladesh phone numbers (E.164 +8801XXXXXXXXX or local 01XXXXXXXXX)
  { re: /\+?8801\d{9}/g, replacement: '[phone]' },
  { re: /\b01\d{9}\b/g, replacement: '[phone]' },
  // Bearer tokens
  { re: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g, replacement: 'Bearer [token]' },
];

function scrubString(s: string): string {
  let out = s;
  for (const { re, replacement } of PATTERNS) out = out.replace(re, replacement);
  return out;
}

function scrubUrl(urlStr: string | undefined): string | undefined {
  if (!urlStr) return urlStr;
  try {
    const url = new URL(urlStr, 'http://placeholder');
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    // For relative URLs, strip the placeholder host back out.
    return urlStr.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return scrubString(urlStr);
  }
}

function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj == null) return obj;
  if (typeof obj === 'string') return scrubString(obj);
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubObject(v, depth + 1);
    }
  }
  return out;
}

export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // User context — keep id (needed for triage), drop everything else.
  if (event.user) {
    const { id } = event.user;
    event.user = id ? { id } : {};
  }

  // Request: scrub URL query, headers, cookies, body.
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    event.request.query_string = typeof event.request.query_string === 'string'
      ? scrubUrl(`?${event.request.query_string}`)?.replace(/^\?/, '')
      : event.request.query_string;
    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      for (const k of Object.keys(headers)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) headers[k] = '[REDACTED]';
      }
    }
    delete event.request.cookies;
    if (event.request.data !== undefined) {
      event.request.data = scrubObject(event.request.data);
    }
  }

  // Error message + stack frames may carry inlined PII.
  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (exc.value) exc.value = scrubString(exc.value);
    }
  }
  if (event.message) {
    event.message = typeof event.message === 'string' ? scrubString(event.message) : event.message;
  }

  // Extra/contexts/tags — best-effort scrub.
  if (event.extra) event.extra = scrubObject(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubObject(event.contexts) as typeof event.contexts;

  // Transaction names often contain query strings on Next.js.
  if (event.transaction) event.transaction = scrubUrl(event.transaction) ?? event.transaction;

  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.message) breadcrumb.message = scrubString(breadcrumb.message);
  if (breadcrumb.data) {
    if (typeof breadcrumb.data.url === 'string') {
      breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
    }
    breadcrumb.data = scrubObject(breadcrumb.data) as typeof breadcrumb.data;
  }
  return breadcrumb;
}
