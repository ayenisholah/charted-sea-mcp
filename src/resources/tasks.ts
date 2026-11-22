import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { Deps } from "../deps.js";
import { describeError } from "../format/errors.js";
import { UNTRUSTED_NOTICE } from "../format/result.js";
import { SCRAPERS } from "../tools/shared.js";

export const TASK_URI_TEMPLATE = "charted-sea://tasks/{scraper}/{uuid}";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads one task with its full, untruncated body. Fetched on demand, never stored (ADR 0003). */
export async function readTaskResource(
  deps: Deps,
  uri: URL,
  variables: Record<string, string | string[]>,
): Promise<ReadResourceResult> {
  const scraper = String(variables["scraper"]);
  const uuid = String(variables["uuid"]);
  if (!(SCRAPERS as readonly string[]).includes(scraper) || !UUID.test(uuid)) {
    throw new Error(`Not a task resource: ${uri.href}`);
  }
  // The raw error is not attached as a cause: it could carry the token. The message is redacted.
  const tasks = await deps.client.tasks
    .read(scraper, { uuids: [uuid], includeAllFields: true })
    .catch((error: unknown) => {
      throw new Error(describeError(error, [deps.config.CHARTED_SEA_TOKEN]));
    });
  const task = tasks[0];
  if (task === undefined) throw new Error(`Task ${uuid} not found for ${scraper}`);
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ notice: UNTRUSTED_NOTICE, task }, null, 2),
      },
    ],
  };
}
