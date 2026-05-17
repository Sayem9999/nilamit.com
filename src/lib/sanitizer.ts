import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize user input to prevent XSS.
 * Strips all HTML tags and potentially dangerous attributes.
 */
export function sanitize(text: string): string {
  if (!text) return '';
  // Bypass DOMPurify for absolute HTTP/HTTPS URLs to prevent query parameter corruption (e.g., &alt=media -> &amp;alt=media)
  if (text.startsWith('http://') || text.startsWith('https://')) {
    return text;
  }
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // Strip all tags
    ALLOWED_ATTR: [], // Strip all attributes
  });
}

/**
 * Clean complex objects (like form inputs) recursively.
 * Preserves Date objects and other custom class instances.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj instanceof Date) {
    return obj;
  }
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? (sanitize(obj) as unknown as T) : obj;
  }

  const result = (Array.isArray(obj) ? [] : {}) as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value);
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }

  return result as unknown as T;
}
