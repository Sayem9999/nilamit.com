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

export const loginLimiter = createLimiter("@upstash/ratelimit/login", 10, "5 m");
export const bidLimiter   = createLimiter("@upstash/ratelimit/bid", 100, "1 m");
