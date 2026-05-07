import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

/**
 * Rate limiting layer.
 *
 * Production policy: FAIL CLOSED for financial / abuse-sensitive limiters.
 *
 *   - bid / login / OTP send / OTP verify must reject when Upstash is
 *     unreachable. Brute-force windows must never silently open up because
 *     of an infra outage.
 *   - api / generic limiters fail OPEN to keep the site usable; the user
 *     experience win outweighs the marginal abuse risk on those paths.
 *   - In non-production we keep the dev DX of "no Redis, no problem".
 */

const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const isProduction = process.env.NODE_ENV === "production";

if (!isConfigured) {
  if (isProduction) {
    log.error(
      "[RateLimit] CRITICAL: UPSTASH_REDIS_REST_URL/TOKEN missing in production. Financial limiters will REJECT all requests.",
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

type Policy = "fail-closed" | "fail-open";

function devNoopLimiter(): Limiter {
  return {
    limit: async () => ({ success: true, remaining: 999, limit: 999, reset: 0 }),
  };
}

function failOpenResult(): LimiterResult {
  return { success: true, remaining: 999, limit: 999, reset: 0 };
}

function failClosedResult(): LimiterResult {
  return { success: false, remaining: 0, limit: 0, reset: Date.now() + 60_000 };
}

function createLimiter(
  prefix: string,
  limit: number,
  window: string,
  policy: Policy = "fail-open",
): Limiter {
  if (!isConfigured || !redis) {
    if (isProduction) {
      return {
        limit: async () => {
          const msg = `[RateLimit:${prefix}] Upstash not configured in production — policy=${policy}`;
          log.error(msg);
          Sentry.captureMessage(msg, "error");
          return policy === "fail-closed" ? failClosedResult() : failOpenResult();
        },
      };
    }
    return devNoopLimiter();
  }

  const limiter = new Ratelimit({
    redis,
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
        log.error(`[RateLimit:${prefix}] Upstash failure (policy=${policy})`, error);
        Sentry.captureException(error, {
          tags: { component: "ratelimit", prefix, policy },
        });
        return policy === "fail-closed" ? failClosedResult() : failOpenResult();
      }
    },
  };
}

// Generic / read-mostly traffic — fail open so brief Redis hiccups don't brick the site.
export const apiLimiter   = createLimiter("rl_api",   100, "60s", "fail-open");

// Financial and credential paths — fail closed. A 429 is recoverable; a free
// brute-force window is not.
export const authLimiter  = createLimiter("rl_auth",   10, "15m", "fail-closed");
export const bidLimiter   = createLimiter("rl_bid",    60, "60s", "fail-closed");
export const loginLimiter = createLimiter("rl_login",  20, "5m",  "fail-closed");

// Per-phone / per-email OTP limiters — must fail closed (6-digit space is small).
export const phoneOtpSendLimiter   = createLimiter("rl_phone_otp_send",   5, "1h",  "fail-closed");
export const phoneOtpVerifyLimiter = createLimiter("rl_phone_otp_verify", 5, "15m", "fail-closed");
export const emailOtpSendLimiter   = createLimiter("rl_email_otp_send",   5, "1h",  "fail-closed");
export const emailOtpVerifyLimiter = createLimiter("rl_email_otp_verify", 5, "15m", "fail-closed");

// Anti-spam for the public Q&A feature. Fail-open is fine — abusive volumes
// of questions are annoying, not financial. Per-user, not per-IP, so account
// gating still throttles even if Upstash is down.
export const qaLimiter             = createLimiter("rl_qa",                10, "10m", "fail-open");
