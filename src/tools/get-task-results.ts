import { isTerminalStatus, type Task } from "charted-sea-client";
import { ok } from "../format/result.js";
import { guarded, scraper, statusSummary, uuids, viewTask } from "./shared.js";
import { defineTool } from "./types.js";

const CACHE_TTL_MS = 10_000;

export const getTaskResults = defineTool({
  name: "get_task_results",
  title: "Get task results",
  description:
    "Status and (truncated) response bodies for up to 100 tasks by UUID. Full bodies are available as resources at the returned resourceUri. Reading results is not billed.",
  inputSchema: { scraper, uuids },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: (deps) => (input) =>
    guarded(deps, "get_task_results", async () => {
      const key = `results:${input.scraper}:${[...input.uuids].sort().join(",")}`;
      let tasks = deps.cache.get(key) as Task[] | undefined;
      if (tasks === undefined) {
        tasks = await deps.client.tasks.read(input.scraper, { uuids: input.uuids });
        if (tasks.length === input.uuids.length && tasks.every((t) => isTerminalStatus(t.status))) {
          deps.cache.set(key, tasks, CACHE_TTL_MS);
        }
      }
      const found = new Set(tasks.map((t) => t.uuid));
      const missing = input.uuids.filter((u) => !found.has(u));
      const views = tasks.map((t) =>
        viewTask(t, input.scraper, deps.config.CHARTED_SEA_MAX_BODY_CHARS),
      );
      return ok(
        `${statusSummary(tasks)}${missing.length > 0 ? `; ${String(missing.length)} not found` : ""}.`,
        { tasks: views, missing },
        { untrusted: views.some((v) => v.bodyPreview !== null) },
      );
    }),
});
