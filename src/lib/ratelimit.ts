import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

/**
 * Rate limiting layer.
 *
 * Production policy: FAIL CLOSED.
 *   - In production, every limiter must succeed against Upstash. If Upstash is
 *     unreachable or env vars are missing, requests are REJECTED (success: false)
 *     and an alert is sent to Sentry. Brute-force windows must never silently
 *     open up because of an infra outage.
 *   - In non-production we keep the dev DX of "no Redis, no problem" — limiters
 *     are no-ops so local development isn't blocked.
 */

const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const isProduction = process.env.NODE_ENV === "production";

if (!isConfigured) {
  if (isProduction) {
    log.error(
      "[RateLimit] CRITICAL: UPSTASH_REDIS_REST_URL/TOKEN missing in production. All rate-limited endpoints will REJECT requests.",
    );
  } else {
    log.warn(
      "[RateLimit] UPSTASH_REDIS_REST_URL/TOKEN missing. Rate limiting is DISABLED for local development.",
    );
  }
}

const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export interface LimiterResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

export interface Limiter {
  limit: (identifier: string) => Promise<LimiterResult>;
}

function devNoopLimiter(): Limiter {
  return {
    limit: async () => ({ success: true, remaining: 999, limit: 999, reset: 0 }),
  };
}

function failClosed(): LimiterResult {
  // 0 remaining, 0 limit, reset in 60s — caller treats as "rate limited"
  return { success: false, remaining: 0, limit: 0, reset: Date.now() + 60_000 };
}

function createLimiter(prefix: string, limit: number, window: string): Limiter {
  if (!isConfigured || !redis) {
    if (isProduction) {
      // In production with no Redis, every request fails closed.
      return {
        limit: async () => {
          Sentry.captureMessage(
            `[RateLimit:${prefix}] Upstash not configured in production — rejecting request`,
            "error",
          );
          return failClosed();
        },
      };
    }
    return devNoopLimiter();
  }

  const limiter = new Ratelimit({
    redis,
    // Upstash's Duration is a branded template-literal type. Window strings
    // are validated by callers (e.g. "60s", "5m", "1h") so we narrow via the
    // function's own parameter type rather than fight the inference.
    limiter: Ratelimit.slidingWindow(
      limit,
      window as Parameters<typeof Ratelimit.slidingWindow>[1],
    ),
    analytics: true,
    prefix,
  });

  return {
    limit: async (identifier: string) => {
      try {
        return await limiter.limit(identifier);
      } catch (error) {
        // Upstash hiccup. In production we MUST reject — silently letting
        // requests through would defeat the purpose of having rate limits.
        log.error(`[RateLimit:${prefix}] Upstash failure`, error);
        Sentry.captureException(error, {
          tags: { component: "ratelimit", prefix },
        });
        if (isProduction) return failClosed();
        // In dev/CI we fail open so flaky local Redis doesn't block work.
        return { success: true, remaining: 1, limit: 1, reset: 0 };
      }
    },
  };
}

/** Specialized rate limiters for different traffic patterns */
export const apiLimiter   = createLimiter("rl_api",   100, "60s");
export const authLimiter  = createLimiter("rl_auth",   10, "15m");
export const bidLimiter   = createLimiter("rl_bid",    60, "60s");
export const loginLimiter = createLimiter("rl_login",  20, "5m");

// Per-phone-number limiters (independent of IP) for SMS abuse protection.
// Sends are expensive (real money). Verify attempts must be capped to prevent
// 6-digit OTP brute force.
export const phoneOtpSendLimiter   = createLimiter("rl_phone_otp_send",   5, "1h");
export const phoneOtpVerifyLimiter = createLimiter("rl_phone_otp_verify", 5, "15m");
export const emailOtpSendLimiter   = createLimiter("rl_email_otp_send",   5, "1h");
