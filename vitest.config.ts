import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __VERSION__: JSON.stringify("0.0.0-test") },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/**/*.live.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // bin.ts is wiring only; the transport tests run it as a process. types/deps are type-only.
      exclude: ["src/bin.ts", "src/deps.ts", "src/tools/types.ts"],
      reporter: ["text", "lcov"],
      thresholds: { perFile: true, lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
