# Requirements

The ID goes in the test name.

## Functional

- **FR-1** The six tools and the resource template in the [spec](SPEC.md) are registered with the documented schemas and annotations.
- **FR-2** `run_scraping_tasks` never submits more tasks than the spend guard allows, and reports the remaining budget.
- **FR-3** No tool call waits longer than `CHARTED_SEA_MAX_WAIT_SEC`; unfinished tasks are returned with their status.
- **FR-4** Bodies longer than `MAX_BODY_CHARS` are truncated inline and fully readable through the resource.
- **FR-5** `check_platform_health` recommendations follow the documented thresholds.
- **FR-6** Works over stdio and Streamable HTTP with the same tool results.

## Non-functional

- **NFR-1 Secrets.** Tokens and proxy credentials never appear in tool results, logs or stderr.
- **NFR-2 Untrusted content.** Every result with scraped content carries the notice; the server never acts on body content.
- **NFR-3 HTTP safety.** HTTP transport binds to `127.0.0.1` by default, rejects requests without `MCP_HTTP_TOKEN`, and rejects foreign `Origin` headers.
- **NFR-4 Logging.** Logs go to stderr only (stdout is the stdio protocol channel), as structured JSON.
- **NFR-5 Startup.** `npx -y charted-sea-mcp` starts in under 2 seconds on a warm cache and fails fast with a clear message if the token is missing.
- **NFR-6 Quality.** 100% coverage per file under `src/` except `bin.ts`.
