import { describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config.js";
import { createLogger } from "../src/log.js";

describe("parseConfig", () => {
  it("applies the documented defaults", () => {
    expect(parseConfig({ CHARTED_SEA_TOKEN: "t" })).toEqual({
      CHARTED_SEA_TOKEN: "t",
      CHARTED_SEA_MAX_TASKS_PER_SESSION: 50,
      CHARTED_SEA_MAX_BODY_CHARS: 20_000,
      CHARTED_SEA_MAX_WAIT_SEC: 300,
      CHARTED_SEA_HEALTH_GO: 0.8,
      CHARTED_SEA_HEALTH_WAIT: 0.5,
      MCP_TRANSPORT: "stdio",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: 3333,
      MCP_ALLOWED_ORIGINS: [],
    });
  });

  it("parses numbers and origin lists from strings", () => {
    const c = parseConfig({
      CHARTED_SEA_TOKEN: "t",
      CHARTED_SEA_MAX_TASKS_PER_SESSION: "5",
      MCP_TRANSPORT: "http",
      MCP_HTTP_TOKEN: "0123456789abcdef",
      MCP_ALLOWED_ORIGINS: "https://a.example, https://b.example,",
    });
    expect([c.CHARTED_SEA_MAX_TASKS_PER_SESSION, c.MCP_ALLOWED_ORIGINS]).toEqual([
      5,
      ["https://a.example", "https://b.example"],
    ]);
  });

  it.each([
    [{}, /CHARTED_SEA_TOKEN is required/],
    [{ CHARTED_SEA_TOKEN: "  " }, /CHARTED_SEA_TOKEN is required/],
    [{ CHARTED_SEA_TOKEN: "t", MCP_TRANSPORT: "http" }, /MCP_HTTP_TOKEN is required/],
    [{ CHARTED_SEA_TOKEN: "t", MCP_HTTP_TOKEN: "short" }, /at least 16/],
    [{ CHARTED_SEA_TOKEN: "t", CHARTED_SEA_MAX_WAIT_SEC: "-1" }, /CHARTED_SEA_MAX_WAIT_SEC/],
    [{ CHARTED_SEA_TOKEN: "t", CHARTED_SEA_HEALTH_GO: "0.4" }, /HEALTH_WAIT must not exceed/],
    [{ CHARTED_SEA_TOKEN: "t", MCP_TRANSPORT: "sse" }, /MCP_TRANSPORT/],
  ])("NFR-5: rejects %j with a readable message", (env, message) => {
    expect(() => parseConfig(env)).toThrow(message);
  });
});

describe("logger", () => {
  it("NFR-4: writes one redacted JSON line per event", () => {
    const write = vi.fn<(line: string) => void>();
    createLogger(["s3cret-token-value"], write)("x", { auth: "Bearer s3cret-token-value" });
    createLogger([], write)("y");
    const [first, second] = write.mock.calls.map((c) => c[0]);
    expect(first).toMatch(/^\{"time":".+","event":"x","auth":"Bearer \*\*\*"\}\n$/);
    expect(second).toContain('"event":"y"');
  });
});
