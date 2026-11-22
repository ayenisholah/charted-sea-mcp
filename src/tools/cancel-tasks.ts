import { ok } from "../format/result.js";
import { guarded, scraper, uuids } from "./shared.js";
import { defineTool } from "./types.js";

export const cancelTasks = defineTool({
  name: "cancel_tasks",
  title: "Cancel tasks",
  description:
    "Cancels tasks (and their sub-tasks) by UUID. Cancelled tasks are not billed. Cancelling by country is deliberately not available here.",
  inputSchema: { scraper, uuids },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: (deps) => (input) =>
    guarded(deps, "cancel_tasks", async () => {
      const result = await deps.client.tasks.cancel(input.scraper, { uuids: input.uuids });
      return ok(`Cancelled ${String(result.uuids.length)} task(s), including sub-tasks.`, {
        cancelled: result.uuids,
      });
    }),
});
