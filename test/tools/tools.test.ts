import {
  NetworkError,
  type TaskMetric,
  type SessionMetric,
  type HealthReport,
  ValidationError,
  WaitTimeoutError,
} from "charted-sea-client";
import { describe, expect, it } from "vitest";
import { UNTRUSTED_NOTICE } from "../../src/format/result.js";
import { cancelTasks } from "../../src/tools/cancel-tasks.js";
import { checkPlatformHealth, recommend } from "../../src/tools/check-platform-health.js";
import { countTasks } from "../../src/tools/count-tasks.js";
import { getTaskResults } from "../../src/tools/get-task-results.js";
import { listScrapers } from "../../src/tools/list-scrapers.js";
import { runScrapingTasks } from "../../src/tools/run-scraping-tasks.js";
import { fakeDeps, task, text, TOKEN, UUID_A, UUID_B } from "../support/fakes.js";

const report = <M>(metrics: M[]): HealthReport<M> => ({
  startAtIncl: "a",
  endAtExcl: "b",
  granularity: "TOTAL",
  scrapers: ["SHOPEE"],
  countries: ["SG"],
  periods: [{ startAtIncl: "a", endAtExcl: "b", metrics }],
});
const tm = (country: string, successRate: number | null, confidence = "HIGH"): TaskMetric => ({
  scraper: "SHOPEE",
  country,
  device: "DESKTOP_WEB",
  knownApi: "PRODUCT_SEARCH",
  successRate,
  confidence,
  avgDurationSec: 1,
  p95DurationSec: 2,
});
const sm: SessionMetric = {
  scraper: "SHOPEE",
  country: "SG",
  device: "DESKTOP_WEB",
  preparationSuccessRate: 0.95,
  confidence: "HIGH",
  avgDurationSec: 1,
  p95DurationSec: 2,
  avgProxyBytes: 3,
  p95ProxyBytes: 4,
};
const run = (input: Partial<Parameters<ReturnType<typeof runScrapingTasks.handler>>[0]> = {}) => ({
  scraper: "shopee" as const,
  requests: [
    { url: "https://shopee.sg/a" },
    { url: "https://shopee.sg/b", method: "POST" as const, payload: { x: 1 } },
  ],
  cacheMaxAgeInSec: 3600,
  waitSec: 60,
  ...input,
});

describe("list_scrapers", () => {
  it("lists scrapers and countries without a network call", async () => {
    const { deps, client } = fakeDeps();
    const r = await listScrapers.handler(deps)({});
    expect(r.structuredContent).toMatchObject({
      scrapers: [
        { name: "shopee", healthName: "SHOPEE" },
        { name: "shopee-android", healthName: "SHOPEE_ANDROID" },
        { name: "lazada", healthName: "LAZADA" },
      ],
    });
    expect(client.tasks.read).not.toHaveBeenCalled();
  });
});

describe("check_platform_health", () => {
  it.each([
    [0.97, "HIGH", "go"],
    [0.97, "LOW", "caution"],
    [0.65, "HIGH", "caution"],
    [0.3, "HIGH", "wait"],
    [null, "HIGH", "caution"],
  ])("FR-5: rate %s with %s confidence → %s", (rate, confidence, expected) => {
    expect(recommend(rate, confidence, 0.8, 0.5)).toBe(expected);
  });

  it("FR-5: queries both metrics with TOTAL granularity and documents the thresholds", async () => {
    const { deps, client } = fakeDeps({ CHARTED_SEA_HEALTH_GO: "0.9" });
    client.health.taskMetrics.mockResolvedValue(
      report([tm("SG", 0.97), tm("ID", 0.3), tm("MY", 0.85)]),
    );
    client.health.sessionMetrics.mockResolvedValue(report([sm]));
    const r = await checkPlatformHealth.handler(deps)({
      scrapers: ["SHOPEE"],
      countries: ["SG", "ID", "MY"],
      window: "LAST_1H",
      knownApis: ["PRODUCT_SEARCH"],
    });
    expect(client.health.taskMetrics).toHaveBeenCalledWith({
      startAtIncl: "LAST_1H",
      granularity: "TOTAL",
      scrapers: ["SHOPEE"],
      countries: ["SG", "ID", "MY"],
      knownApis: ["PRODUCT_SEARCH"],
    });
    expect(text(r)).toMatch(/^Task health over LAST_1H: 1 go, 1 caution, 1 wait\./);
    const data = r.structuredContent as {
      thresholds: { go: string };
      taskMetrics: { recommendation: string; knownApi?: string }[];
      sessionMetrics: { recommendation: string; knownApi?: string }[];
    };
    expect(data.thresholds.go).toContain("0.9");
    expect(data.taskMetrics.map((m) => m.recommendation)).toEqual(["go", "wait", "caution"]);
    expect(data.sessionMetrics[0]).toMatchObject({ recommendation: "go" });
    expect(data.sessionMetrics[0]?.knownApi).toBeUndefined();
  });

  it("omits knownApis when not given", async () => {
    const { deps, client } = fakeDeps();
    client.health.taskMetrics.mockResolvedValue(report([]));
    client.health.sessionMetrics.mockResolvedValue(report([]));
    await checkPlatformHealth.handler(deps)({
      scrapers: ["LAZADA"],
      countries: ["SG"],
      window: "LAST_24H",
    });
    expect(client.health.taskMetrics.mock.calls[0]?.[0]).not.toHaveProperty("knownApis");
  });
});

describe("run_scraping_tasks", () => {
  it("FR-2/FR-3: submits asynchronously, waits up to waitSec, and reports the remaining budget", async () => {
    const { deps, client } = fakeDeps({ CHARTED_SEA_MAX_TASKS_PER_SESSION: "5" });
    client.tasks.run.mockResolvedValue([task(UUID_A, "PENDING"), task(UUID_B, "PENDING")]);
    client.tasks.waitForResults.mockResolvedValue([
      task(UUID_A, "SUCCESS", '{"items":[]}'),
      { ...task(UUID_B, "BLOCKED_TOO_MANY_TIMES"), errorMessage: "blocked by platform" },
    ]);
    const r = await runScrapingTasks.handler(deps)(run({ includeFields: ["uuid"] }));
    expect(client.tasks.run).toHaveBeenCalledWith(
      "shopee",
      [
        { url: "https://shopee.sg/a" },
        { url: "https://shopee.sg/b", method: "POST", payload: { x: 1 } },
      ],
      { cacheMaxAgeInSec: 3600, includeFields: ["uuid"] },
    );
    expect(client.tasks.waitForResults).toHaveBeenCalledWith("shopee", [UUID_A, UUID_B], {
      maxWaitMs: 60_000,
    });
    expect(text(r).startsWith(UNTRUSTED_NOTICE)).toBe(true);
    expect(text(r)).toContain(
      "1 SUCCESS, 1 BLOCKED_TOO_MANY_TIMES. Spend guard: 3 submission(s) left",
    );
    expect(r.structuredContent).toMatchObject({
      spendRemaining: 3,
      tasks: [
        { resourceUri: `charted-sea://tasks/shopee/${UUID_A}`, bodyTruncated: false },
        { bodyPreview: null, errorMessage: "blocked by platform" },
      ],
    });
  });

  it("FR-2: rejects a batch over the budget without calling the API, leaving the budget unchanged", async () => {
    const { deps, client } = fakeDeps({ CHARTED_SEA_MAX_TASKS_PER_SESSION: "1" });
    const r = await runScrapingTasks.handler(deps)(run());
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("only 1 of 1 remain");
    expect(client.tasks.run).not.toHaveBeenCalled();
    expect(deps.spend.remaining()).toBe(1);
  });

  it("FR-3: caps the wait at CHARTED_SEA_MAX_WAIT_SEC and returns unfinished tasks with their status", async () => {
    const { deps, client } = fakeDeps({ CHARTED_SEA_MAX_WAIT_SEC: "10" });
    client.tasks.run.mockResolvedValue([task(UUID_A, "PENDING"), task(UUID_B, "PENDING")]);
    client.tasks.waitForResults.mockRejectedValue(
      new WaitTimeoutError("t", [task(UUID_A, "SUCCESS", "x")]),
    );
    const r = await runScrapingTasks.handler(deps)(run({ waitSec: 300 }));
    expect(client.tasks.waitForResults.mock.calls[0]?.[2]).toEqual({ maxWaitMs: 10_000 });
    expect(r.structuredContent).toMatchObject({
      waitedSec: 10,
      tasks: [{ status: "SUCCESS" }, { status: "PENDING" }],
    });
  });

  it("returns immediately with waitSec 0, and without the notice when there are no bodies", async () => {
    const { deps, client } = fakeDeps();
    client.tasks.run.mockResolvedValue([{ url: "u", status: "PENDING", responseBody: null }]);
    const r = await runScrapingTasks.handler(deps)(
      run({ waitSec: 0, requests: [{ url: "https://shopee.sg/a" }] }),
    );
    expect(client.tasks.waitForResults).not.toHaveBeenCalled();
    expect(text(r).startsWith(UNTRUSTED_NOTICE)).toBe(false);
    expect(r.structuredContent).toMatchObject({ tasks: [{ uuid: null, resourceUri: null }] });
  });

  it("FR-4: truncates long bodies and keeps the full body behind the resource", async () => {
    const { deps, client } = fakeDeps({ CHARTED_SEA_MAX_BODY_CHARS: "100" });
    client.tasks.run.mockResolvedValue([task(UUID_A, "SUCCESS", "x".repeat(250))]);
    const r = await runScrapingTasks.handler(deps)(run({ waitSec: 0 }));
    expect(r.structuredContent).toMatchObject({
      tasks: [{ bodyTruncated: true, bodyPreview: "x".repeat(100) }],
    });
  });

  it("refunds the budget when the request certainly failed, but not when it may have been submitted", async () => {
    const { deps, client } = fakeDeps({ CHARTED_SEA_MAX_TASKS_PER_SESSION: "10" });
    client.tasks.run.mockRejectedValueOnce(new ValidationError("bad"));
    expect((await runScrapingTasks.handler(deps)(run())).isError).toBe(true);
    expect(deps.spend.remaining()).toBe(10);
    client.tasks.run.mockRejectedValueOnce(new NetworkError("reset", { maybeSubmitted: true }));
    const r = await runScrapingTasks.handler(deps)(run());
    expect(text(r)).toContain("may have been submitted");
    expect(deps.spend.remaining()).toBe(8);
  });

  it("surfaces wait failures other than a timeout as tool errors", async () => {
    const { deps, client } = fakeDeps();
    client.tasks.run.mockResolvedValue([task(UUID_A, "PENDING")]);
    client.tasks.waitForResults.mockRejectedValue(new ValidationError("x"));
    expect((await runScrapingTasks.handler(deps)(run())).isError).toBe(true);
  });
});

describe("get_task_results", () => {
  it("returns views, reports missing UUIDs, and caches only complete terminal sets for 10 s", async () => {
    const { deps, client, advance } = fakeDeps();
    client.tasks.read.mockResolvedValue([task(UUID_A, "RUNNING")]);
    const first = await getTaskResults.handler(deps)({
      scraper: "lazada",
      uuids: [UUID_A, UUID_B],
    });
    expect(text(first)).toContain("1 RUNNING; 1 not found.");
    expect(first.structuredContent).toMatchObject({ missing: [UUID_B] });

    client.tasks.read.mockResolvedValue([task(UUID_B, "SUCCESS", "b"), task(UUID_A, "CANCELLED")]);
    await getTaskResults.handler(deps)({ scraper: "lazada", uuids: [UUID_A, UUID_B] });
    const cached = await getTaskResults.handler(deps)({
      scraper: "lazada",
      uuids: [UUID_B, UUID_A],
    });
    expect(client.tasks.read).toHaveBeenCalledTimes(2);
    expect(text(cached).startsWith(UNTRUSTED_NOTICE)).toBe(true);
    advance(10_000);
    await getTaskResults.handler(deps)({ scraper: "lazada", uuids: [UUID_A, UUID_B] });
    expect(client.tasks.read).toHaveBeenCalledTimes(3);
  });

  it("says when nothing was found", async () => {
    const { deps, client } = fakeDeps();
    client.tasks.read.mockResolvedValue([]);
    expect(
      text(await getTaskResults.handler(deps)({ scraper: "shopee", uuids: [UUID_A] })),
    ).toMatch(/^no tasks; 1 not found\./);
  });
});

describe("count_tasks and cancel_tasks", () => {
  it("counts with totals per status", async () => {
    const { deps, client } = fakeDeps();
    client.tasks.count.mockResolvedValue([
      { country: "ID", status: "SUCCESS", count: 3 },
      { country: "MY", status: "SUCCESS", count: 2 },
      { country: "ID", status: "PENDING", count: 1 },
    ]);
    const r = await countTasks.handler(deps)({
      scraper: "shopee",
      statuses: ["SUCCESS", "PENDING"],
      since: "2026-07-01T00:00:00Z",
    });
    expect(client.tasks.count).toHaveBeenCalledWith("shopee", {
      statuses: ["SUCCESS", "PENDING"],
      minPendingAt: "2026-07-01T00:00:00Z",
    });
    expect(r.structuredContent).toMatchObject({ totals: { SUCCESS: 5, PENDING: 1 }, total: 6 });
    await countTasks.handler(deps)({ scraper: "shopee" });
    expect(client.tasks.count).toHaveBeenLastCalledWith("shopee", {});
  });

  it("cancels by UUID only", async () => {
    const { deps, client } = fakeDeps();
    client.tasks.cancel.mockResolvedValue({ uuids: [UUID_A, UUID_B], countries: [] });
    const r = await cancelTasks.handler(deps)({ scraper: "shopee", uuids: [UUID_A] });
    expect(client.tasks.cancel).toHaveBeenCalledWith("shopee", { uuids: [UUID_A] });
    expect(text(r)).toMatch(/^Cancelled 2 task\(s\)/);
  });
});

describe("guarded", () => {
  it("rejects calls over the per-tool rate limit with when to retry", async () => {
    const { deps, client } = fakeDeps({}, { limiter: { take: () => 2_100 } });
    const r = await countTasks.handler(deps)({ scraper: "shopee" });
    expect(text(r)).toBe("Too many count_tasks calls. Retry in 3 s.");
    expect(client.tasks.count).not.toHaveBeenCalled();
  });

  it("NFR-1: a token echoed in an error never reaches the result or the log", async () => {
    const { deps, client, log } = fakeDeps();
    client.tasks.cancel.mockRejectedValue(new ValidationError(`token ${TOKEN} rejected`));
    const r = await cancelTasks.handler(deps)({ scraper: "shopee", uuids: [UUID_A] });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    client.tasks.cancel.mockRejectedValue("not an error");
    expect(text(await cancelTasks.handler(deps)({ scraper: "shopee", uuids: [UUID_A] }))).toMatch(
      /Unexpected error/,
    );
    expect(log).toHaveBeenLastCalledWith("tool_error", { tool: "cancel_tasks", error: "string" });
  });
});
