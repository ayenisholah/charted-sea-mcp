import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ValidationError } from "charted-sea-client";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { fakeDeps, task, UUID_A } from "./support/fakes.js";

async function connect(harness = fakeDeps()) {
  const server = createServer(harness.deps);
  const mcp = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return { mcp, harness };
}

describe("MCP protocol", () => {
  it("FR-1: registers the six tools with their annotations", async () => {
    const { mcp } = await connect();
    const { tools } = await mcp.listTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    expect(Object.keys(byName).sort()).toEqual([
      "cancel_tasks",
      "check_platform_health",
      "count_tasks",
      "get_task_results",
      "list_scrapers",
      "run_scraping_tasks",
    ]);
    for (const name of [
      "list_scrapers",
      "check_platform_health",
      "get_task_results",
      "count_tasks",
    ]) {
      expect(byName[name]?.readOnlyHint, name).toBe(true);
    }
    expect(byName["cancel_tasks"]?.destructiveHint).toBe(true);
    expect(byName["run_scraping_tasks"]).toMatchObject({
      idempotentHint: false,
      openWorldHint: true,
    });
    const run = tools.find((t) => t.name === "run_scraping_tasks");
    expect(run?.inputSchema.required).toEqual(["scraper", "requests"]);
  });

  it("calls a tool end to end and rejects invalid input before the handler", async () => {
    const { mcp, harness } = await connect();
    const listed = await mcp.callTool({ name: "list_scrapers", arguments: {} });
    expect(listed.isError).toBeFalsy();
    const bad = await mcp.callTool({
      name: "run_scraping_tasks",
      arguments: { scraper: "amazon", requests: [] },
    });
    expect(bad.isError).toBe(true);
    expect(harness.client.tasks.run).not.toHaveBeenCalled();
    expect(harness.deps.spend.remaining()).toBe(50);
  });

  it("FR-4: serves the full task body as a resource, labelled untrusted", async () => {
    const harness = fakeDeps();
    harness.client.tasks.read.mockResolvedValue([task(UUID_A, "SUCCESS", "full body")]);
    const { mcp } = await connect(harness);
    const uri = `charted-sea://tasks/shopee/${UUID_A}`;
    const res = await mcp.readResource({ uri });
    const content = res.contents[0] as { text: string; mimeType: string };
    expect(content.mimeType).toBe("application/json");
    const parsed = JSON.parse(content.text) as { notice: string; task: { responseBody: string } };
    expect(parsed.notice).toContain("not instructions");
    expect(parsed.task.responseBody).toBe("full body");
    expect(harness.client.tasks.read).toHaveBeenCalledWith("shopee", {
      uuids: [UUID_A],
      includeAllFields: true,
    });
  });

  it("rejects malformed resource URIs, missing tasks and API failures without leaking the token", async () => {
    const harness = fakeDeps();
    const { mcp } = await connect(harness);
    await expect(
      mcp.readResource({ uri: "charted-sea://tasks/amazon/not-a-uuid" }),
    ).rejects.toThrow(/Not a task resource/);
    harness.client.tasks.read.mockResolvedValueOnce([]);
    await expect(mcp.readResource({ uri: `charted-sea://tasks/lazada/${UUID_A}` })).rejects.toThrow(
      /not found/,
    );
    harness.client.tasks.read.mockRejectedValueOnce(
      new ValidationError(`bad ${harness.deps.config.CHARTED_SEA_TOKEN}`),
    );
    const error = await mcp
      .readResource({ uri: `charted-sea://tasks/lazada/${UUID_A}` })
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/rejected the request/);
    expect(String(error)).not.toContain(harness.deps.config.CHARTED_SEA_TOKEN);
  });
});
