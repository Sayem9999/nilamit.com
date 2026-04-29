/**
 * PII Filter Utility for nilamit.com
 * Prevents platform circumvention by hiding phone numbers and contact details
 * in public descriptions and reviews.
 */

// Includes English (0-9) and Bangla (০-৯) digits, handling common 01... prefix
// Two forms: the `g` flag version for replace() calls, and a flag-free version
// for .test() so the stateful lastIndex never causes alternating false-negatives.
const BANGLADESH_PHONE_REGEX        = /(?:\+?88)?(?:0|০)(?:1|১)[3-9৩-৯](?:[\s-]?[0-9০-৯]){8}/g;
const BANGLADESH_PHONE_REGEX_TEST   = /(?:\+?88)?(?:0|০)(?:1|১)[3-9৩-৯](?:[\s-]?[0-9০-৯]){8}/;
const EMAIL_REGEX                   = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_REGEX_TEST              = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Phonetic and word-based bypasses common in Bangladesh
const DIGIT_WORDS = ["zero","shunno","one","ek","two","dui","three","tin","four","char","five","pach","six","choy","seven","saat","eight","aat","nine","noy"];
const WORD_DIGIT_REGEX = new RegExp(`\\b(${DIGIT_WORDS.join("|")})\\b`, "gi");

const BYPASS_KEYWORDS = [
  /\bwhatsapp\b/gi,
  /\bviber\b/gi,
  /\bimo\b/gi,
  /\binbox\b/gi,
  /\bcall me\b/gi,
  /\bcontact\b/gi,
  /\bmessage me\b/gi,
  /\bমোবাইল\b/g,
  /\bফোন\b/g,
  /\bনম্বর\b/g,
];

const REPLACEMENT_TEXT = "[নিরাপত্তার স্বার্থে লুকানো]";

export function filterPII(text: string | null | undefined): string {
  if (!text) return "";

  let sanitized = text;

  // 1. Filter Phone Numbers (English & Bangla digits)
  sanitized = sanitized.replace(BANGLADESH_PHONE_REGEX, REPLACEMENT_TEXT);

  // 2. Filter Emails
  sanitized = sanitized.replace(EMAIL_REGEX, REPLACEMENT_TEXT);

  // 3. Filter Word-Digits (Phonetic bypass)
  sanitized = sanitized.replace(WORD_DIGIT_REGEX, REPLACEMENT_TEXT);

  // 4. Filter Keywords
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
  if (BANGLADESH_PHONE_REGEX_TEST.test(text)) return true;
  if (EMAIL_REGEX_TEST.test(text)) return true;
  return BYPASS_KEYWORDS.some((regex) => regex.test(text));
}
