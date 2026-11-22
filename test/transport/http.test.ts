import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../../src/server.js";
import { createHttpTransport } from "../../src/transport/http.js";
import { fakeDeps } from "../support/fakes.js";

const HTTP_TOKEN = "http-token-0123456789";
const servers: Server[] = [];

async function start(
  makeServer = () => createServer(fakeDeps().deps),
  allowedOrigins: string[] = [],
) {
  const log: unknown[] = [];
  const server = createHttpTransport({
    host: "127.0.0.1",
    port: 0,
    token: HTTP_TOKEN,
    allowedOrigins,
    makeServer,
    log: (e, m) => log.push([e, m]),
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${String(port)}`, log };
}

const rpc = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${HTTP_TOKEN}`,
    ...headers,
  },
  body: JSON.stringify(body),
});
const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "t", version: "0" },
  },
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe("Streamable HTTP transport", () => {
  it("answers /healthz without auth and 404s other paths", async () => {
    const { url } = await start();
    expect(await (await fetch(`${url}/healthz`)).json()).toEqual({ status: "ok" });
    expect((await fetch(`${url}/other`)).status).toBe(404);
    expect((await fetch(url)).status).toBe(404);
  });

  it("FR-6: serves MCP over HTTP with the bearer token", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/mcp`, rpc(initialize));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { serverInfo: { name: string } } };
    expect(body.result.serverInfo.name).toBe("charted-sea-mcp");
    const list = await fetch(`${url}/mcp`, rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    expect(((await list.json()) as { result: { tools: unknown[] } }).result.tools).toHaveLength(6);
  });

  it("NFR-3: rejects missing or wrong tokens with 401", async () => {
    const { url } = await start();
    const none = await fetch(`${url}/mcp`, rpc(initialize, { authorization: "" }));
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe("Bearer");
    expect(
      (await fetch(`${url}/mcp`, rpc(initialize, { authorization: "Bearer wrong" }))).status,
    ).toBe(401);
    expect(
      (await fetch(`${url}/mcp`, rpc(initialize, { authorization: `Basic ${HTTP_TOKEN}` }))).status,
    ).toBe(401);
  });

  it("NFR-3: rejects foreign Origin headers, allows localhost and configured origins", async () => {
    const { url } = await start(undefined, ["https://app.example"]);
    expect(
      (await fetch(`${url}/mcp`, rpc(initialize, { origin: "https://evil.example" }))).status,
    ).toBe(403);
    expect(
      (await fetch(`${url}/mcp`, rpc(initialize, { origin: "http://localhost:6274" }))).status,
    ).toBe(200);
    expect(
      (await fetch(`${url}/mcp`, rpc(initialize, { origin: "https://app.example" }))).status,
    ).toBe(200);
  });

  it("NFR-3: rejects a request with no Authorization header at all", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(initialize),
    });
    expect(res.status).toBe(401);
  });

  it("drops the connection when a failure happens after the response started", async () => {
    const late = {
      connect: async (t: { handleRequest: unknown }) => {
        t.handleRequest = async (
          _req: unknown,
          res: { writeHead(code: number): void; flushHeaders(): void },
        ) => {
          res.writeHead(200);
          res.flushHeaders();
          throw "late failure";
        };
      },
      close: async () => {},
    };
    const { url, log } = await start(() => late as never);
    await expect(fetch(`${url}/mcp`, rpc(initialize)).then((r) => r.text())).rejects.toThrow();
    expect(log).toEqual([["http_error", { error: "unknown" }]]);
  });

  it("returns 500 without details when the server can't be built", async () => {
    const { url, log } = await start(() => {
      throw new Error("boom");
    });
    const res = await fetch(`${url}/mcp`, rpc(initialize));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
    expect(log).toEqual([["http_error", { error: "Error" }]]);
  });
});
