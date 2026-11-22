import { createHash, timingSafeEqual } from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface HttpOptions {
  host: string;
  port: number;
  /** Bearer token clients must send. Separate from the Charted Sea token. */
  token: string;
  /** Extra allowed Origin values. Requests without an Origin (non-browser clients) are allowed. */
  allowedOrigins: readonly string[];
  /** A fresh server per request (stateless mode); tools share deps, so the spend guard is global. */
  makeServer: () => McpServer;
  log: (event: string, meta?: Record<string, unknown>) => void;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

function authorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  return timingSafeEqual(digest(given), digest(token));
}

function originAllowed(req: IncomingMessage, options: HttpOptions): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  return local || options.allowedOrigins.includes(origin);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

/** Streamable HTTP on `/mcp` with bearer auth and an Origin check, plus `/healthz`. */
export function createHttpTransport(options: HttpOptions): Server {
  return createHttpServer((req, res) => {
    void (async () => {
      const path = new URL(String(req.url), "http://localhost").pathname;
      if (path === "/healthz" && req.method === "GET") {
        send(res, 200, { status: "ok" });
        return;
      }
      if (path !== "/mcp") {
        send(res, 404, { error: "not found" });
        return;
      }
      if (!originAllowed(req, options)) {
        send(res, 403, { error: "origin not allowed" });
        return;
      }
      if (!authorized(req, options.token)) {
        res.setHeader("www-authenticate", "Bearer");
        send(res, 401, { error: "missing or invalid bearer token" });
        return;
      }
      try {
        const server = options.makeServer();
        // No sessionIdGenerator: stateless, a fresh server and transport per request.
        const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
        res.on("close", () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
      } catch (error) {
        options.log("http_error", { error: error instanceof Error ? error.name : "unknown" });
        if (res.headersSent) res.destroy();
        else send(res, 500, { error: "internal error" });
      }
    })();
  });
}
