import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createCache } from "../../src/guard/cache.js";
import { createRateLimiter } from "../../src/guard/rate-limiter.js";
import { createSpendGuard } from "../../src/guard/spend.js";

describe("spend guard", () => {
  it("FR-2 property: accepted total ≤ budget, and a rejection never changes the remaining count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.array(fc.integer({ min: 1, max: 30 })),
        (budget, batches) => {
          const guard = createSpendGuard(budget);
          let accepted = 0;
          for (const n of batches) {
            const before = guard.remaining();
            const r = guard.reserve(n);
            if (r.ok) accepted += n;
            else expect(guard.remaining()).toBe(before);
            expect(r.remaining).toBe(guard.remaining());
          }
          expect(accepted).toBeLessThanOrEqual(budget);
          expect(guard.remaining()).toBe(budget - accepted);
        },
      ),
    );
  });

  it("refunds, never below zero used", () => {
    const guard = createSpendGuard(5);
    guard.reserve(3);
    guard.refund(3);
    guard.refund(10);
    expect(guard.remaining()).toBe(5);
  });
});

describe("rate limiter", () => {
  it("allows a burst up to capacity per key, then refills one token per interval", () => {
    let t = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 1_000 }, () => t);
    expect([limiter.take("a"), limiter.take("a"), limiter.take("a")]).toEqual([0, 0, 1_000]);
    expect(limiter.take("b")).toBe(0);
    t = 400;
    expect(limiter.take("a")).toBe(600);
    t = 2_500;
    expect([limiter.take("a"), limiter.take("a"), limiter.take("a")]).toEqual([0, 0, 500]);
  });
});

describe("cache", () => {
  it("expires entries after their TTL and evicts the oldest past maxKeys", () => {
    let t = 0;
    const cache = createCache(() => t, 2);
    cache.set("a", 1, 100);
    cache.set("b", 2, 100);
    cache.set("a", 3, 100);
    cache.set("c", 4, 100);
    expect([cache.get("a"), cache.get("b"), cache.get("c")]).toEqual([3, undefined, 4]);
    t = 100;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("keeps working when maxKeys is 0", () => {
    const cache = createCache(() => 0, 0);
    cache.set("a", 1, 10);
    expect(cache.get("a")).toBe(1);
  });
});
