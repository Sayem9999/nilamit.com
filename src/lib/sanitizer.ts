import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize user input to prevent XSS.
 * Strips all HTML tags and potentially dangerous attributes.
 */
export function sanitize(text: string): string {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // Strip all tags
    ALLOWED_ATTR: [], // Strip all attributes
  });
}

/**
 * Clean complex objects (like form inputs) recursively.
 */
export function sanitizeObject<T>(obj: T): T {
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
