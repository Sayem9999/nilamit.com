import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Allow creation even if env vars are missing during build, but operations will fail later.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const isConfigured = Boolean(redisUrl && redisToken);

if (!isConfigured) {
  console.warn("⚠️ [RateLimit] UPSTASH_REDIS_REST_URL/TOKEN missing. Rate limiting is DISABLED.");
}

const redis = new Redis({
  url: redisUrl ?? "https://dummy-redis-url.upstash.io",
  token: redisToken ?? "dummy_token",
});

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "5 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/login",
});

export const bidLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/bid",
});
