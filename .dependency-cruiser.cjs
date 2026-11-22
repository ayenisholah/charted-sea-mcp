/** Dependency rules from docs/ARCHITECTURE.md. */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "only-bin-wires",
      comment: "Nothing imports the entrypoint.",
      severity: "error",
      from: {},
      to: { path: "^src/bin\\.ts$" },
    },
    {
      name: "tools-dont-touch-transports",
      severity: "error",
      from: { path: "^src/(tools|resources|guard|format)/" },
      to: { path: "^src/(transport|server)" },
    },
    {
      name: "pure-guards-and-format",
      comment: "Guards and formatting are pure: no Node built-ins.",
      severity: "error",
      from: { path: "^src/(guard|format)/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "only-transports-listen",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/transport/" },
      to: { path: "^(node:)?(http|https|net)$", dependencyTypes: ["core"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
