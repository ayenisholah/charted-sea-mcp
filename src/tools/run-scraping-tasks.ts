import { NetworkError, type Task, TimeoutError, WaitTimeoutError } from "charted-sea-client";
import { z } from "zod";
import { fail, ok } from "../format/result.js";
import { guarded, scraper, statusSummary, viewTask } from "./shared.js";
import { defineTool } from "./types.js";

const MAX_REQUESTS_PER_CALL = 20;

export const runScrapingTasks = defineTool({
  name: "run_scraping_tasks",
  title: "Run scraping tasks",
  description:
    "Submits 1–20 Shopee or Lazada URLs to Charted Sea and optionally waits for results. SPENDS CREDITS for each successful task not served from cache. Check platform health first. Tasks still running when the wait ends are returned with their status; fetch them later with get_task_results.",
  inputSchema: {
    scraper,
    requests: z
      .array(
        z.object({
          url: z.url(),
          method: z.enum(["GET", "POST"]).optional(),
          payload: z.unknown().optional().describe("Request body when method is POST"),
        }),
      )
      .min(1)
      .max(MAX_REQUESTS_PER_CALL),
    cacheMaxAgeInSec: z
      .number()
      .int()
      .min(0)
      .default(3600)
      .describe("Return a cached result up to this age instead of scraping again (not billed)"),
    waitSec: z
      .number()
      .int()
      .min(0)
      .default(60)
      .describe("How long to wait for results; 0 returns immediately"),
    includeFields: z.array(z.string().min(1)).optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: (deps) => (input) =>
    guarded(deps, "run_scraping_tasks", async () => {
      const n = input.requests.length;
      const reservation = deps.spend.reserve(n);
      if (!reservation.ok) {
        return fail(
          `Spend guard: this call would submit ${String(n)} task(s) but only ${String(reservation.remaining)} of ${String(deps.config.CHARTED_SEA_MAX_TASKS_PER_SESSION)} remain for this server session. Ask the user to raise CHARTED_SEA_MAX_TASKS_PER_SESSION and restart the server.`,
        );
      }

      let submitted: Task[];
      try {
        const requests = input.requests.map(({ url, method, payload }) => ({
          url,
          ...(method === undefined ? {} : { method }),
          ...(payload === undefined ? {} : { payload }),
        }));
        submitted = await deps.client.tasks.run(input.scraper, requests, {
          cacheMaxAgeInSec: input.cacheMaxAgeInSec,
          ...(input.includeFields ? { includeFields: input.includeFields } : {}),
        });
      } catch (error) {
        // Only refund when the request certainly didn't reach the server.
        const ambiguous =
          (error instanceof NetworkError || error instanceof TimeoutError) && error.maybeSubmitted;
        if (!ambiguous) deps.spend.refund(n);
        throw error;
      }

      const waitSec = Math.min(input.waitSec, deps.config.CHARTED_SEA_MAX_WAIT_SEC);
      const ids = submitted.flatMap((t) => (t.uuid === undefined ? [] : [t.uuid]));
      let tasks = submitted;
      if (waitSec > 0 && ids.length > 0) {
        try {
          tasks = await deps.client.tasks.waitForResults(input.scraper, ids, {
            maxWaitMs: waitSec * 1000,
          });
        } catch (error) {
          if (!(error instanceof WaitTimeoutError)) throw error;
          const latest = new Map(error.partial.map((t) => [t.uuid, t]));
          tasks = submitted.map((t) => latest.get(t.uuid) ?? t);
        }
      }

      const views = tasks.map((t) =>
        viewTask(t, input.scraper, deps.config.CHARTED_SEA_MAX_BODY_CHARS),
      );
      return ok(
        `Submitted ${String(n)} task(s): ${statusSummary(tasks)}. Spend guard: ${String(reservation.remaining)} submission(s) left this session.`,
        { tasks: views, spendRemaining: reservation.remaining, waitedSec: waitSec },
        { untrusted: views.some((v) => v.bodyPreview !== null) },
      );
    }),
});
