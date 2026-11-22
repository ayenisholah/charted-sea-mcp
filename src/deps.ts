import type { ChartedSeaClient } from "charted-sea-client";
import type { Config } from "./config.js";
import type { Cache } from "./guard/cache.js";
import type { RateLimiter } from "./guard/rate-limiter.js";
import type { SpendGuard } from "./guard/spend.js";

/** The parts of the client the tools use, so tests can pass a fake. */
interface ToolClient {
  tasks: Pick<ChartedSeaClient["tasks"], "run" | "read" | "count" | "cancel" | "waitForResults">;
  health: Pick<ChartedSeaClient["health"], "taskMetrics" | "sessionMetrics">;
}

/** Everything a tool handler needs. Built once in bin.ts; faked in tests. */
export interface Deps {
  client: ToolClient;
  config: Config;
  spend: SpendGuard;
  limiter: RateLimiter;
  cache: Cache;
  now: () => number;
  log: (event: string, meta?: Record<string, unknown>) => void;
}
