# charted-sea-mcp

An [MCP](https://modelcontextprotocol.io) server for the [Charted Sea](https://chartedsea.com) scraping API. It lets Claude, Cursor and other MCP clients check marketplace scraping health, run scraping tasks on Shopee and Lazada, and read results, with a spend guard so an agent can't burn credits in a loop.

> **Unofficial.** Not affiliated with or endorsed by Charted Sea.
> **Status: planned.** This README describes the 0.1.0 target. See the [roadmap](docs/ROADMAP.md).

<!-- Badges go live at M0: CI · coverage · npm version · npm provenance · OpenSSF Scorecard -->

## Tools

| Tool | What it does | Annotations |
|---|---|---|
| `list_scrapers` | Supported scrapers, countries and doc links | read-only |
| `check_platform_health` | Recent success rate and latency per scraper, country and endpoint, so the agent can wait out a block | read-only |
| `run_scraping_tasks` | Submit up to 20 URLs, optionally wait for results (bounded) | spends credits |
| `get_task_results` | Status and (truncated) bodies by UUID | read-only |
| `count_tasks` | Task counts by status and country | read-only |
| `cancel_tasks` | Cancel tasks by UUID | destructive |

Full response bodies are available as resources: `charted-sea://tasks/{scraper}/{uuid}`.

## Install

Claude Code:

```sh
claude mcp add charted-sea --env CHARTED_SEA_TOKEN=<your token> -- npx -y charted-sea-mcp
```

Cursor and other clients (`mcp.json`):

```json
{
  "mcpServers": {
    "charted-sea": {
      "command": "npx",
      "args": ["-y", "charted-sea-mcp"],
      "env": { "CHARTED_SEA_TOKEN": "<your token>" }
    }
  }
}
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CHARTED_SEA_TOKEN` | required | API token from the Charted Sea console |
| `CHARTED_SEA_MAX_TASKS_PER_SESSION` | `50` | Spend guard: submissions allowed per server process |
| `CHARTED_SEA_MAX_BODY_CHARS` | `20000` | Inline body size before truncation (full body stays a resource) |
| `CHARTED_SEA_MAX_WAIT_SEC` | `300` | Longest a tool call waits for results |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_HTTP_PORT` / `MCP_HTTP_TOKEN` | `3333` / required for http | Streamable HTTP on `127.0.0.1` with its own bearer token |

## Documentation

[Spec](docs/SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Requirements](docs/REQUIREMENTS.md) · [Test strategy](docs/TEST_STRATEGY.md) · [CI/CD](docs/CI_CD.md) · [Release process](docs/RELEASE_PROCESS.md) · [Roadmap](docs/ROADMAP.md) · [ADRs](docs/adr/) · [Security](SECURITY.md)

Built on [charted-sea-client](../charted-sea-client/README.md).

## Licence

[MIT](LICENSE)
