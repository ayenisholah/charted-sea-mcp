import type { Task } from "charted-sea-client";
import { vi } from "vitest";
import { parseConfig } from "../../src/config.js";
import type { Deps } from "../../src/deps.js";
import { createCache } from "../../src/guard/cache.js";
import { createSpendGuard } from "../../src/guard/spend.js";

export const TOKEN = "cs_sentinel_5e3f9a1b7c";
export const UUID_A = "398a3b4d-241c-4297-9e81-5c4c6ecce340";
export const UUID_B = "785ebeaf-ae2c-4453-908b-c7dac008fbf4";

export const task = (uuid: string, status: string, body: string | null = null): Task => ({
  uuid,
  url: `https://shopee.sg/item/${uuid}`,
  status,
  responseBody: body,
});

/** Deps with a fake client (every method a vi.fn), an unlimited rate limiter and a fixed clock. */
export function fakeDeps(env: Record<string, string> = {}, overrides: Partial<Deps> = {}) {
  let clock = 0;
  const client = {
    tasks: {
      run: vi.fn<Deps["client"]["tasks"]["run"]>(),
      read: vi.fn<Deps["client"]["tasks"]["read"]>(),
      count: vi.fn<Deps["client"]["tasks"]["count"]>(),
      cancel: vi.fn<Deps["client"]["tasks"]["cancel"]>(),
      waitForResults: vi.fn<Deps["client"]["tasks"]["waitForResults"]>(),
    },
    health: {
      taskMetrics: vi.fn<Deps["client"]["health"]["taskMetrics"]>(),
      sessionMetrics: vi.fn<Deps["client"]["health"]["sessionMetrics"]>(),
    },
  };
  const config = parseConfig({ CHARTED_SEA_TOKEN: TOKEN, ...env });
  const log = vi.fn<Deps["log"]>();
  const deps: Deps = {
    client,
    config,
    spend: createSpendGuard(config.CHARTED_SEA_MAX_TASKS_PER_SESSION),
    limiter: { take: () => 0 },
    cache: createCache(() => clock),
    now: () => clock,
    log,
    ...overrides,
  };
  return {
    deps,
    client,
    log,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

/** The text of a tool result. */
export function text(result: { content: unknown[] }): string {
  return (result.content as { text: string }[]).map((c) => c.text).join("\n");
}
