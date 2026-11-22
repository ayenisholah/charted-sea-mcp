#!/usr/bin/env node
// Entrypoint: wiring only. Covered by the transport tests as a process, not by unit tests.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "charted-sea-client";
import { type Config, parseConfig } from "./config.js";
import type { Deps } from "./deps.js";
import { createCache } from "./guard/cache.js";
import { createRateLimiter } from "./guard/rate-limiter.js";
import { createSpendGuard } from "./guard/spend.js";
import { createLogger } from "./log.js";
import { createServer } from "./server.js";
import { createHttpTransport } from "./transport/http.js";

function stderr(line: string): void {
  process.stderr.write(line);
}

let config: Config;
try {
  config = parseConfig(process.env);
} catch (error) {
  stderr(`charted-sea-mcp: ${(error as Error).message}\n`);
  process.exit(1);
}

const log = createLogger(
  [config.CHARTED_SEA_TOKEN, config.MCP_HTTP_TOKEN ?? ""].filter(Boolean),
  stderr,
);
const now = Date.now;
const deps: Deps = {
  client: createClient({
    token: config.CHARTED_SEA_TOKEN,
    userAgent: "charted-sea-mcp",
    ...(config.CHARTED_SEA_BASE_URL ? { baseUrl: config.CHARTED_SEA_BASE_URL } : {}),
  }),
  config,
  spend: createSpendGuard(config.CHARTED_SEA_MAX_TASKS_PER_SESSION),
  limiter: createRateLimiter({ capacity: 10, refillIntervalMs: 3_000 }, now),
  cache: createCache(now),
  now,
  log,
};

if (config.MCP_TRANSPORT === "stdio") {
  await createServer(deps).connect(new StdioServerTransport());
  log("started", { transport: "stdio", spendBudget: config.CHARTED_SEA_MAX_TASKS_PER_SESSION });
} else {
  const server = createHttpTransport({
    host: config.MCP_HTTP_HOST,
    port: config.MCP_HTTP_PORT,
    token: config.MCP_HTTP_TOKEN ?? "",
    allowedOrigins: config.MCP_ALLOWED_ORIGINS,
    makeServer: () => createServer(deps),
    log,
  });
  server.listen(config.MCP_HTTP_PORT, config.MCP_HTTP_HOST, () => {
    log("started", { transport: "http", host: config.MCP_HTTP_HOST, port: config.MCP_HTTP_PORT });
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
