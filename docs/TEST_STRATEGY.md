# Test strategy

| Level | Scope | Tooling | Runs |
|---|---|---|---|
| Unit | Guards, truncation, summaries, config | Vitest, fast-check | every PR |
| Handler | Each tool handler with a fake client, clock and guards | Vitest | every PR |
| Protocol | Real `McpServer` connected to an MCP `Client` over `InMemoryTransport`: list tools, call each tool, read a resource, check schemas and annotations | `@modelcontextprotocol/sdk` | every PR |
| Transport | Spawn the built server over stdio; start HTTP and check auth, `Origin` and loopback binding | Vitest + child process | every PR |
| Inspector smoke | `npx @modelcontextprotocol/inspector --cli` lists tools against the built package | MCP Inspector CLI | every PR |
| Live smoke | One cached `run_scraping_tasks` and one `check_platform_health` | Vitest, `*.live.test.ts` | manual dispatch only |
| Agent scenarios (optional) | A model uses the tools for "check health, then fetch 3 products"; asserts on tool calls, not wording | scripted, report only | manual (M2+) |

The fake client is built from the same documented fixtures as charted-sea-client, so handler tests and client contract tests agree on shapes.

## Properties worth testing

- Spend guard: for any sequence of batch sizes, accepted total ≤ budget, and a rejection never changes the remaining count.
- Truncation: preview length ≤ limit for any input, including multi-byte characters; `bodyTruncated` is true iff something was cut.
- Redaction: a sentinel token never appears in any tool result or captured stderr across all error paths.

## Coverage

100% lines, branches, functions and statements per file in `src/`, excluding `bin.ts` (wiring only, covered by the transport tests as a process).
