// Live smoke test: real API through the tool handlers. At most one task credit the first time;
// cacheMaxAgeInSec=86400 makes repeats free for a day. Never part of `npm test`.
import { createClient } from "charted-sea-client";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/config.js";
import type { Deps } from "../../src/deps.js";
import { createCache } from "../../src/guard/cache.js";
import { createRateLimiter } from "../../src/guard/rate-limiter.js";
import { createSpendGuard } from "../../src/guard/spend.js";
import { checkPlatformHealth } from "../../src/tools/check-platform-health.js";
import { runScrapingTasks } from "../../src/tools/run-scraping-tasks.js";

const token = process.env["CHARTED_SEA_TOKEN"];

describe.skipIf(!token)("live MCP tools", () => {
  const config = parseConfig({
    CHARTED_SEA_TOKEN: token ?? "",
    CHARTED_SEA_MAX_TASKS_PER_SESSION: "1",
  });
  const deps: Deps = {
    client: createClient({ token: config.CHARTED_SEA_TOKEN }),
    config,
    spend: createSpendGuard(1),
    limiter: createRateLimiter({ capacity: 10, refillIntervalMs: 1_000 }, Date.now),
    cache: createCache(Date.now),
    now: Date.now,
    log: (event, meta) => {
      console.info(event, meta);
    },
  };

  it("check_platform_health returns recommendations", async () => {
    const r = await checkPlatformHealth.handler(deps)({
      scrapers: ["SHOPEE"],
      countries: ["SG"],
      window: "LAST_1H",
    });
    console.info((r.content[0] as { text: string }).text.split("\n")[0]);
    expect(r.isError).toBeFalsy();
  });

  it("run_scraping_tasks submits one cached task within the spend guard", async () => {
    const r = await runScrapingTasks.handler(deps)({
      scraper: "shopee",
      requests: [{ url: "https://shopee.sg/api/v4/search/search_items?keyword=tshirt" }],
      cacheMaxAgeInSec: 86_400,
      waitSec: 120,
    });
    console.info((r.content[0] as { text: string }).text.split("\n")[0]);
    expect(r.isError).toBeFalsy();
    expect(deps.spend.remaining()).toBe(0);
  });
});
