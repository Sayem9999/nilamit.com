/**
 * Formatting utilities for Bangladesh market
 * Uses Bangladeshi number system: lakhs (1,00,000) and crores (1,00,00,000)
 */

export function formatBDT(amount: number): string {
  if (amount < 0) return `-৳${formatBDTNumber(Math.abs(amount))}`;
  return `৳${formatBDTNumber(amount)}`;
}

function formatBDTNumber(num: number): string {
  const str = Math.floor(num).toString();
  if (str.length <= 3) return str;

  // Last 3 digits
  let result = str.slice(-3);
  let remaining = str.slice(0, -3);

  // Group remaining in pairs (lakhs, crores)
  while (remaining.length > 0) {
    const chunk = remaining.slice(-2);
    result = chunk + "," + result;
    remaining = remaining.slice(0, -2);
  }

  return result;
}

export function formatTimeRemaining(endTime: Date | string): string {
  const end = new Date(endTime);
  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString("en-BD");
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
