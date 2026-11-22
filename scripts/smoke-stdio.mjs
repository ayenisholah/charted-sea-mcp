// Starts the built server over stdio, lists its tools, and checks startup fails fast without a token.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const bin = new URL("../dist/bin.js", import.meta.url).pathname;

const noToken = spawnSync(process.execPath, [bin], {
  env: { PATH: process.env.PATH },
  encoding: "utf8",
  timeout: 10_000,
});
assert.equal(noToken.status, 1, "exits 1 without a token");
assert.match(noToken.stderr, /CHARTED_SEA_TOKEN is required/);
assert.equal(noToken.stdout, "", "nothing on stdout");

const child = spawn(process.execPath, [bin], {
  env: { PATH: process.env.PATH, CHARTED_SEA_TOKEN: "cs_test_000" },
});
const send = (msg) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);
let buffer = "";
const started = Date.now();
const tools = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("no tools/list response in 10 s")), 10_000);
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (const line of buffer.split("\n").slice(0, -1)) {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        send({ method: "notifications/initialized" });
        send({ id: 2, method: "tools/list" });
      }
      if (msg.id === 2) {
        clearTimeout(timer);
        resolve(msg.result.tools.map((t) => t.name));
      }
    }
    buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
  });
  send({
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    },
  });
});
child.kill();
assert.deepEqual(tools.sort(), [
  "cancel_tasks",
  "check_platform_health",
  "count_tasks",
  "get_task_results",
  "list_scrapers",
  "run_scraping_tasks",
]);
console.log(`stdio OK: ${tools.length} tools in ${Date.now() - started} ms`);
