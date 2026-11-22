import { TASK_STATUSES } from "charted-sea-client";
import { z } from "zod";
import { ok } from "../format/result.js";
import { guarded, scraper } from "./shared.js";
import { defineTool } from "./types.js";

export const countTasks = defineTool({
  name: "count_tasks",
  title: "Count tasks",
  description:
    "Counts this account's tasks by status and country (default: the last 7 days). Use PENDING,RUNNING,BLOCKED,ERROR to see what is still in flight.",
  inputSchema: {
    scraper,
    statuses: z.array(z.enum(TASK_STATUSES as [string, ...string[]])).optional(),
    since: z.iso.datetime({ offset: true }).optional().describe("ISO 8601; default 7 days ago"),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: (deps) => (input) =>
    guarded(deps, "count_tasks", async () => {
      const rows = await deps.client.tasks.count(input.scraper, {
        ...(input.statuses ? { statuses: input.statuses } : {}),
        ...(input.since ? { minPendingAt: input.since } : {}),
      });
      const totals: Record<string, number> = {};
      for (const r of rows) totals[r.status] = (totals[r.status] ?? 0) + r.count;
      const total = Object.values(totals).reduce((a, b) => a + b, 0);
      return ok(`${String(total)} task(s) across ${String(rows.length)} status/country group(s).`, {
        rows,
        totals,
        total,
      });
    }),
});
