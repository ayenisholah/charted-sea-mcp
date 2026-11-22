import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Locally, read CHARTED_SEA_TOKEN from the git-ignored .env. In CI it comes from the `live` environment.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m?.[1] && m[2] !== undefined && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export default defineConfig({
  define: { __VERSION__: JSON.stringify("0.0.0-live") },
  test: { include: ["test/**/*.live.test.ts"], testTimeout: 15 * 60_000 },
});
