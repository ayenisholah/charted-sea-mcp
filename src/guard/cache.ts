// Adapted from mcp-suite's Cache interface: a small in-memory TTL map with an injected clock.

export interface Cache {
  get(key: string): unknown;
  set(key: string, value: unknown, ttlMs: number): void;
}

export function createCache(now: () => number, maxKeys = 500): Cache {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    get(key: string) {
      const hit = store.get(key);
      if (hit === undefined) return undefined;
      if (hit.expiresAt <= now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value, ttlMs) {
      store.delete(key);
      if (store.size >= maxKeys) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: now() + ttlMs });
    },
  };
}
