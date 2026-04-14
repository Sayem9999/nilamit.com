import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a Bangladeshi phone number to +880XXXXXXXXXX format.
 * Handles: 01XXXXXXXXX, 880XXXXXXXXXX, +880XXXXXXXXXX
 */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/\D/g, ''); // Remove non-digits
  
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '+88' + cleaned;
  }
  
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    return '+' + cleaned;
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '+880' + cleaned;
  }

  // If it already seems like a canonical number but without the +, add it
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
      return '+' + cleaned;
  }

  // Handle common mistake of 017... without leading 0 (if user thinks it's 10 digits)
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '+880' + cleaned;
  }

  return raw.trim(); // Return as is if we can't normalize, validation logic will catch it
}
