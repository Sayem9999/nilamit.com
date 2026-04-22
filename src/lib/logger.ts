/**
 * Production Logger Utility
 * Centralizes all application logs for easy export to external services (e.g., Sentry, Axiom).
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const log = {
  info: (message: string, context?: unknown) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, context || '');
  },
  warn: (message: string, context?: unknown) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, context || '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '');
    // In production, you would send this to Sentry/DataDog here
  }
};
