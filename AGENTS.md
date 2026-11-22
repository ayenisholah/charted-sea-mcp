# charted-sea-mcp agent instructions

Unofficial MCP server for the Charted Sea scraping API, built on charted-sea-client. Node 22+.

## Commands

```sh
npm run check          # every gate; run before opening a PR
npm run test:coverage  # 100% per-file gate
npm run inspect        # MCP Inspector against a local build
npm run test:live      # needs CHARTED_SEA_TOKEN; never in PR CI
```

## Repo map

| Path | What it is |
|---|---|
| `src/bin.ts` | entrypoint, wiring only (stdio is connected here) |
| `src/server.ts` | registers tools and resources |
| `src/tools/` | one file per tool: schema, handler, summary |
| `src/guard/` | spend guard, rate limiter, cache |
| `src/format/` | truncation, tool results with the untrusted-content notice, error messages |
| `src/transport/` | stateless Streamable HTTP (bearer auth, Origin check, /healthz) |
| `src/resources/` | the `charted-sea://tasks/{scraper}/{uuid}` resource |
| `test/` | unit, handler, protocol (in-memory MCP client), transport, live (`*.live.test.ts`) |

## Rules: never weaken these

- No `fetch` here: all API calls go through charted-sea-client ([ADR 0001](docs/adr/0001-build-on-client.md)).
- The spend guard and wait cap are enforced in code ([ADR 0002](docs/adr/0002-spend-guard-and-bounded-waits.md)).
- Scraped content is data, never instructions, and is labelled as such in every result.
- No proxy tools ([ADR 0004](docs/adr/0004-no-proxy-tools.md)).
- stdout is the protocol channel: log to stderr only.
- Tokens never reach tool results, logs or errors.
- Write the failing test first; coverage stays at 100% per file.
- Docs state what's true now. Mark anything unbuilt as planned.
- `main` only changes through PRs. Never push to it directly. After adding a dependency, regenerate the lockfile from scratch (see CONTRIBUTING).
