import type { HealthReport, SessionMetric, TaskMetric } from "charted-sea-client";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { ok } from "../format/result.js";
import { COUNTRIES, guarded, HEALTH_SCRAPERS } from "./shared.js";
import { defineTool } from "./types.js";

type Recommendation = "go" | "caution" | "wait";

/** go: rate ≥ go threshold with HIGH confidence; wait: rate < wait threshold; otherwise caution. */
export function recommend(
  rate: number | null,
  confidence: string,
  go: number,
  wait: number,
): Recommendation {
  if (rate === null) return "caution";
  if (rate < wait) return "wait";
  return rate >= go && confidence === "HIGH" ? "go" : "caution";
}

function rows<M extends TaskMetric | SessionMetric>(
  report: HealthReport<M>,
  rateOf: (m: M) => number | null,
  deps: Deps,
) {
  const { CHARTED_SEA_HEALTH_GO: go, CHARTED_SEA_HEALTH_WAIT: wait } = deps.config;
  return report.periods.flatMap((p) =>
    p.metrics.map((m) => ({
      scraper: m.scraper,
      country: m.country,
      device: m.device,
      ...("knownApi" in m ? { knownApi: m.knownApi } : {}),
      successRate: rateOf(m),
      confidence: m.confidence,
      p95DurationSec: m.p95DurationSec,
      recommendation: recommend(rateOf(m), m.confidence, go, wait),
    })),
  );
}

export const checkPlatformHealth = defineTool({
  name: "check_platform_health",
  title: "Check platform health",
  description:
    "Recent success rates and latency for scraping tasks and session preparation, per scraper, country, device and endpoint, aggregated across all Charted Sea customers. Use before submitting tasks: if the recommendation is 'wait', the platform is blocking and tasks would likely fail.",
  inputSchema: {
    scrapers: z.array(z.enum(HEALTH_SCRAPERS)).min(1).max(3),
    countries: z.array(z.enum(COUNTRIES)).min(1).max(12),
    window: z.enum(["LAST_1H", "LAST_24H", "LAST_72H"]).default("LAST_1H"),
    knownApis: z
      .array(z.string().min(1))
      .max(20)
      .optional()
      .describe("e.g. PRODUCT_SEARCH, PRODUCT_DETAIL"),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: (deps) => (input) =>
    guarded(deps, "check_platform_health", async () => {
      const query = {
        startAtIncl: input.window,
        granularity: "TOTAL" as const,
        scrapers: input.scrapers,
        countries: input.countries,
      };
      const [tasks, sessions] = await Promise.all([
        deps.client.health.taskMetrics(
          input.knownApis ? { ...query, knownApis: input.knownApis } : query,
        ),
        deps.client.health.sessionMetrics(query),
      ]);
      const taskRows = rows(tasks, (m) => m.successRate, deps);
      const sessionRows = rows(sessions, (m) => m.preparationSuccessRate, deps);
      const counts = { go: 0, caution: 0, wait: 0 };
      for (const r of taskRows) counts[r.recommendation] += 1;
      return ok(
        `Task health over ${input.window}: ${String(counts.go)} go, ${String(counts.caution)} caution, ${String(counts.wait)} wait.`,
        {
          window: input.window,
          thresholds: {
            go: `successRate ≥ ${String(deps.config.CHARTED_SEA_HEALTH_GO)} with HIGH confidence`,
            wait: `successRate < ${String(deps.config.CHARTED_SEA_HEALTH_WAIT)}`,
            caution: "anything else, including LOW confidence or no data",
          },
          taskMetrics: taskRows,
          sessionMetrics: sessionRows,
        },
      );
    }),
});
