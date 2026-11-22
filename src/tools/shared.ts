import type { Task } from "charted-sea-client";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { describeError } from "../format/errors.js";
import { fail } from "../format/result.js";
import { truncate } from "../format/truncate.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const SCRAPERS = ["shopee", "shopee-android", "lazada"] as const;
export const HEALTH_SCRAPERS = ["SHOPEE", "SHOPEE_ANDROID", "LAZADA"] as const;
export const COUNTRIES = [
  "SG",
  "ID",
  "TH",
  "MY",
  "PH",
  "VN",
  "BR",
  "MX",
  "CL",
  "CO",
  "AR",
  "TW",
] as const;

export const scraper = z.enum(SCRAPERS).describe("Scraper path name");
export const uuids = z.array(z.uuid()).min(1).max(100).describe("Task UUIDs (1–100)");

/** A task as tools return it: body cut to a preview, full body behind resourceUri. */
export interface TaskView {
  uuid: string | null;
  url: string;
  status: string;
  errorMessage?: string;
  bodyPreview: string | null;
  bodyTruncated: boolean;
  resourceUri: string | null;
}

export function viewTask(task: Task, scraperName: string, maxChars: number): TaskView {
  const body = task.responseBody === null ? null : truncate(task.responseBody, maxChars);
  return {
    uuid: task.uuid ?? null,
    url: task.url,
    status: task.status,
    ...(task.errorMessage === undefined ? {} : { errorMessage: task.errorMessage }),
    bodyPreview: body?.preview ?? null,
    bodyTruncated: body?.truncated ?? false,
    resourceUri: task.uuid === undefined ? null : `charted-sea://tasks/${scraperName}/${task.uuid}`,
  };
}

/** Counts tasks per status, e.g. "2 SUCCESS, 1 RUNNING". */
export function statusSummary(tasks: readonly { status: string }[]): string {
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  return [...counts].map(([s, n]) => `${String(n)} ${s}`).join(", ") || "no tasks";
}

/**
 * Runs a handler behind the per-tool rate limiter, turning client errors into tool errors.
 * Stack traces and secrets never reach the agent.
 */
export async function guarded(
  deps: Deps,
  tool: string,
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const waitMs = deps.limiter.take(tool);
  if (waitMs > 0)
    return fail(`Too many ${tool} calls. Retry in ${String(Math.ceil(waitMs / 1000))} s.`);
  try {
    return await run();
  } catch (error) {
    deps.log("tool_error", { tool, error: error instanceof Error ? error.name : typeof error });
    return fail(describeError(error, [deps.config.CHARTED_SEA_TOKEN]));
  }
}
