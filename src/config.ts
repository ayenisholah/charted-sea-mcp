import { z } from "zod";

const int = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const TOKEN_REQUIRED = "CHARTED_SEA_TOKEN is required (Charted Sea Console → Get API Token)";

const schema = z
  .object({
    CHARTED_SEA_TOKEN: z.string({ error: TOKEN_REQUIRED }).trim().min(1, TOKEN_REQUIRED),
    CHARTED_SEA_BASE_URL: z.url().optional(),
    CHARTED_SEA_MAX_TASKS_PER_SESSION: int(50, 0, 100_000),
    CHARTED_SEA_MAX_BODY_CHARS: int(20_000, 100, 5_000_000),
    CHARTED_SEA_MAX_WAIT_SEC: int(300, 0, 3_600),
    CHARTED_SEA_HEALTH_GO: z.coerce.number().min(0).max(1).default(0.8),
    CHARTED_SEA_HEALTH_WAIT: z.coerce.number().min(0).max(1).default(0.5),
    MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
    MCP_HTTP_HOST: z.string().default("127.0.0.1"),
    MCP_HTTP_PORT: int(3333, 1, 65_535),
    MCP_HTTP_TOKEN: z.string().min(16, "MCP_HTTP_TOKEN must be at least 16 characters").optional(),
    MCP_ALLOWED_ORIGINS: z
      .string()
      .default("")
      .transform((s) =>
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
  })
  .refine((c) => c.MCP_TRANSPORT !== "http" || c.MCP_HTTP_TOKEN !== undefined, {
    message: "MCP_HTTP_TOKEN is required when MCP_TRANSPORT=http",
    path: ["MCP_HTTP_TOKEN"],
  })
  .refine((c) => c.CHARTED_SEA_HEALTH_WAIT <= c.CHARTED_SEA_HEALTH_GO, {
    message: "CHARTED_SEA_HEALTH_WAIT must not exceed CHARTED_SEA_HEALTH_GO",
    path: ["CHARTED_SEA_HEALTH_WAIT"],
  });

export type Config = z.output<typeof schema>;

/** Parses the environment. Throws one readable message listing every problem. */
export function parseConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  throw new Error(`Invalid configuration:\n  ${problems.join("\n  ")}`);
}
