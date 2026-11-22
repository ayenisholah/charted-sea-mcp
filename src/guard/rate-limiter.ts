// Adapted from mcp-suite's token bucket: one bucket per tool and an injected clock.

export interface BucketConfig {
  capacity: number;
  refillIntervalMs: number;
}

export interface RateLimiter {
  /** Takes a token for `key`. Returns 0 on success, or the ms to wait before retrying. */
  take(key: string): number;
}

export function createRateLimiter(config: BucketConfig, now: () => number): RateLimiter {
  const buckets = new Map<string, { tokens: number; lastRefillAt: number }>();
  return {
    take(key) {
      const t = now();
      const bucket = buckets.get(key) ?? { tokens: config.capacity, lastRefillAt: t };
      buckets.set(key, bucket);
      const cycles = Math.floor((t - bucket.lastRefillAt) / config.refillIntervalMs);
      if (cycles > 0) {
        bucket.tokens = Math.min(config.capacity, bucket.tokens + cycles);
        bucket.lastRefillAt += cycles * config.refillIntervalMs;
      }
      if (bucket.tokens < 1) return config.refillIntervalMs - (t - bucket.lastRefillAt);
      bucket.tokens -= 1;
      return 0;
    },
  };
}
