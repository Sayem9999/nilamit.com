/**
 * PII Filter Utility for nilamit.com
 * Prevents platform circumvention by hiding phone numbers and contact details
 * in public descriptions and reviews.
 */

const BANGLADESH_PHONE_REGEX = /(?:\+?88)?01[3-9](?:[\s-]?\d){8}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Circumvention keywords often used to move transactions off-platform
const BYPASS_KEYWORDS = [
  /\bwhatsapp\b/gi,
  /\bviber\b/gi,
  /\bimo\b/gi,
  /\binbox\b/gi,
  /\bcall me\b/gi,
  /\bcontact\b/gi,
  /\bমোবাইল\b/g,
  /\bফোন\b/g,
];

const REPLACEMENT_TEXT = "[নিরাপত্তার স্বার্থে লুকানো]";

/**
 * Sweeps text for phone numbers, emails, and bypass keywords.
 * Replaces them with a safety placeholder.
 */
export function filterPII(text: string | null | undefined): string {
  if (!text) return "";

  let sanitized = text;

  // 1. Filter Phone Numbers
  sanitized = sanitized.replace(BANGLADESH_PHONE_REGEX, REPLACEMENT_TEXT);

  // 2. Filter Emails
  sanitized = sanitized.replace(EMAIL_REGEX, REPLACEMENT_TEXT);

  // 3. Filter Keywords
  BYPASS_KEYWORDS.forEach((regex) => {
    sanitized = sanitized.replace(regex, REPLACEMENT_TEXT);
  });

  return sanitized;
}

/**
 * Checks if text contains PII without modifying it.
 * Useful for warnings or strict blocking.
 */
export function containsPII(text: string): boolean {
  if (BANGLADESH_PHONE_REGEX.test(text)) return true;
  if (EMAIL_REGEX.test(text)) return true;
  return BYPASS_KEYWORDS.some((regex) => regex.test(text));
}
