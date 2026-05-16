/**
 * PII Filter Utility for nilamit.com
 * Prevents platform circumvention by hiding phone numbers and contact details
 * in public descriptions and reviews.
 */

// Includes English (0-9) and Bangla (০-৯) digits, handling common 01... prefix
// Two forms: the `g` flag version for replace() calls, and a flag-free version
// for .test() so the stateful lastIndex never causes alternating false-negatives.
const _BANGLADESH_PHONE_REGEX_TEST   = /(?:\+?88)?(?:0|০)(?:1|১)[3-9৩-৯](?:[\s-]?[0-9০-৯]){8}/;
const EMAIL_REGEX                   = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_REGEX_TEST              = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Broaden email obfuscation patterns
const OBFUSCATED_EMAIL_REGEX = /[a-zA-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\{at\})\s*[a-zA-Z0-9.-]+\s*(?:\.|\[dot\]|\(dot\)|\{dot\}|dot)\s*[a-zA-Z]{2,}/gi;

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
  /\bযোগাযোগ\b/g,
  /\bহোয়াটসঅ্যাপ\b/g,
  /\@\w+/g,            // Handles like @name
  /\b(ig|fb|insta)\b/gi,
  /\b(fb\.com|t\.me)\b/gi,
];

const REPLACEMENT_TEXT = "[নিরাপত্তার স্বার্থে লুকানো]";

function maskObfuscatedPhones(text: string): string {
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };

  interface DigitMapping {
    char: string;
    origIdx: number;
  }

  const digits: DigitMapping[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char >= '0' && char <= '9') {
      digits.push({ char, origIdx: i });
    } else if (bnToEn[char] !== undefined) {
      digits.push({ char: bnToEn[char], origIdx: i });
    }
  }

  const digitsStr = digits.map(d => d.char).join('');
  const PHONE_REGEX = /(?:88)?01[3-9]\d{8}/g;
  
  let match;
  let result = text;
  
  interface Range {
    start: number;
    end: number;
  }
  const ranges: Range[] = [];

  while ((match = PHONE_REGEX.exec(digitsStr)) !== null) {
    const startIdx = match.index;
    const endIdx = startIdx + match[0].length - 1;
    
    const origStart = digits[startIdx].origIdx;
    const origEnd = digits[endIdx].origIdx;
    ranges.push({ start: origStart, end: origEnd });
  }

  // Sort ranges in descending order of start position to replace from right to left safely
  ranges.sort((a, b) => b.start - a.start);

  // Merge overlapping ranges if any
  const mergedRanges: Range[] = [];
  for (const r of ranges) {
    if (mergedRanges.length === 0) {
      mergedRanges.push(r);
    } else {
      const prev = mergedRanges[mergedRanges.length - 1];
      if (r.end >= prev.start) {
        prev.start = Math.min(prev.start, r.start);
        prev.end = Math.max(prev.end, r.end);
      } else {
        mergedRanges.push(r);
      }
    }
  }

  for (const range of mergedRanges) {
    result = result.substring(0, range.start) + REPLACEMENT_TEXT + result.substring(range.end + 1);
  }

  return result;
}

export function filterPII(text: string | null | undefined): string {
  if (!text) return "";

  let sanitized = text;

  // 1. Filter Phone Numbers (including arbitrary spacers and letter obfuscations)
  sanitized = maskObfuscatedPhones(sanitized);

  // 2. Filter Emails (standard & obfuscated)
  sanitized = sanitized.replace(EMAIL_REGEX, REPLACEMENT_TEXT);
  sanitized = sanitized.replace(OBFUSCATED_EMAIL_REGEX, REPLACEMENT_TEXT);

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
  if (!text) return false;

  // 1. Check obfuscated phone number
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  const digits: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char >= '0' && char <= '9') {
      digits.push(char);
    } else if (bnToEn[char] !== undefined) {
      digits.push(bnToEn[char]);
    }
  }
  const digitsStr = digits.join('');
  const PHONE_REGEX_ONLY = /(?:88)?01[3-9]\d{8}/;
  if (PHONE_REGEX_ONLY.test(digitsStr)) return true;

  // 2. Check emails
  if (EMAIL_REGEX_TEST.test(text)) return true;
  const OBFUSCATED_EMAIL_TEST = /[a-zA-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\{at\})\s*[a-zA-Z0-9.-]+\s*(?:\.|\[dot\]|\(dot\)|\{dot\}|dot)\s*[a-zA-Z]{2,}/i;
  if (OBFUSCATED_EMAIL_TEST.test(text)) return true;

  // 3. Check phonetic word digits
  const WORD_DIGIT_REGEX_TEST = new RegExp(`\\b(${DIGIT_WORDS.join("|")})\\b`, "i");
  if (WORD_DIGIT_REGEX_TEST.test(text)) return true;

  return BYPASS_KEYWORDS.some((regex) => regex.test(text));
}
