import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const isConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

if (!isConfigured) {
  console.warn("⚠️ [RateLimit] UPSTASH_REDIS_REST_URL/TOKEN missing. Rate limiting is DISABLED.");
}

const redis = isConfigured ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : null;

function createLimiter(prefix: string, limit: number, window: string) {
  if (!isConfigured || !redis) {
    return { limit: async () => ({ success: true, remaining: 999, limit: 999, reset: 0 }) };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window as `${number} ${string}`),
    analytics: true,
    prefix,
  });
}

/** Specialized rate limiters for different traffic patterns */
export const apiLimiter   = createLimiter('rl_api', 50, '60s');
export const authLimiter  = createLimiter('rl_auth', 5, '15m');
export const bidLimiter   = createLimiter('rl_bid', 20, '60s');
export const loginLimiter = createLimiter('rl_login', 10, '5m');
