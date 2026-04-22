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
  
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window as `${number} ${string}`),
    analytics: true,
    prefix,
  });

  // Wrap the limiter to provide runtime fail-open resilience
  return {
    limit: async (identifier: string) => {
      try {
        return await limiter.limit(identifier);
      } catch (error) {
        console.error(`[RateLimit] Runtime failure for ${prefix}:`, error);
        return { success: true, remaining: 1, limit: 1, reset: 0 }; // Fail-open
      }
    }
  };
}

/** Specialized rate limiters for different traffic patterns */
export const apiLimiter   = createLimiter('rl_api', 50, '60s');
export const authLimiter  = createLimiter('rl_auth', 5, '15m');
export const bidLimiter   = createLimiter('rl_bid', 20, '60s');
export const loginLimiter = createLimiter('rl_login', 10, '5m');
