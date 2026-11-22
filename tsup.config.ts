import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  clean: true,
  sourcemap: true,
  target: "node20",
  define: { __VERSION__: JSON.stringify(version) },
});
