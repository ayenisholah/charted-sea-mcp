# charted-sea-mcp

An [MCP](https://modelcontextprotocol.io) server for the [Charted Sea](https://chartedsea.com) scraping API. It lets Claude, Cursor and other AI agents check marketplace scraping health, run scraping tasks on Shopee and Lazada, and read the results, with a spend guard so an agent can't burn credits in a loop.

[![CI](https://github.com/ayenisholah/charted-sea-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ayenisholah/charted-sea-mcp/actions/workflows/ci.yml)

> **Unofficial.** Not affiliated with or endorsed by Charted Sea.
> **Status: pre-release.** All six tools, the task resource, stdio and HTTP transports and the Docker image are built and tested, including against the live API. It isn't on npm yet; until then, run it from a clone (see [Install](#install)).

## What it solves

AI agents are good at deciding *what* to look up, but calling a paid scraping API directly from an agent is risky:

- **Agents loop.** One bad plan can submit the same 20 URLs a hundred times. The server caps submissions per session (default 50). Over-budget calls are refused with the remaining count, and calls default to a one-hour cache, which isn't billed.
- **Agents wait badly.** A tool call that blocks for 10 minutes stalls the conversation. Waits are capped (default 300 s), and unfinished tasks come back with their UUIDs so the agent can check later.
- **Responses are huge.** Marketplace pages are often hundreds of kilobytes. Tool results carry a preview (default 20,000 characters), and the full body is a resource the agent can read only when it needs to.
- **Scraped text can carry prompt injection.** Every result with scraped content is labelled as third-party data, not instructions, and the server never acts on body content.
- **Platforms block scrapers.** `check_platform_health` turns Charted Sea's health metrics into a `go` / `caution` / `wait` recommendation, so the agent can wait out a block instead of paying for failures.
- **Secrets.** The token never reaches tool results, logs or errors. There are no proxy-configuration tools ([ADR 0004](docs/adr/0004-no-proxy-tools.md)), so an agent can't leak proxy credentials or wipe a working configuration.

All API calls go through [charted-sea-client](https://github.com/ayenisholah/charted-sea-client). That means the server inherits its safe retry policy: a dropped `run` is never resubmitted.

## Tools

| Tool | What it does | Annotations |
|---|---|---|
| `list_scrapers` | Supported scrapers, countries and doc links. No network call | read-only |
| `check_platform_health` | Success rate and latency per scraper, country, device and endpoint, with a `go` / `caution` / `wait` recommendation | read-only |
| `run_scraping_tasks` | Submit 1–20 URLs (GET or POST), optionally wait for results, within the spend guard | spends credits |
| `get_task_results` | Status and truncated bodies for up to 100 tasks by UUID (not billed) | read-only |
| `count_tasks` | Task counts by status and country | read-only |
| `cancel_tasks` | Cancel tasks by UUID (cancelling by country is deliberately not exposed) | destructive |

**Resource:** `charted-sea://tasks/{scraper}/{uuid}` returns the full task with its untruncated body, as JSON.

## Install

You need Node 20 or newer and a Charted Sea API token: log in to the [console](https://console.chartedsea.com), then choose **Get API Token → Generate Token**.

### From a clone (until the npm release)

```sh
git clone https://github.com/ayenisholah/charted-sea-mcp && cd charted-sea-mcp
npm ci && npm run build
```

Then point your MCP client at `node /absolute/path/to/charted-sea-mcp/dist/bin.js`:

```sh
# Claude Code
claude mcp add charted-sea --env CHARTED_SEA_TOKEN=<your token> -- node /absolute/path/to/charted-sea-mcp/dist/bin.js
```

```json
// Cursor and other clients: mcp.json
{
  "mcpServers": {
    "charted-sea": {
      "command": "node",
      "args": ["/absolute/path/to/charted-sea-mcp/dist/bin.js"],
      "env": { "CHARTED_SEA_TOKEN": "<your token>" }
    }
  }
}
```

### From npm (after the first release)

Replace the command with `npx -y charted-sea-mcp`:

```sh
claude mcp add charted-sea --env CHARTED_SEA_TOKEN=<your token> -- npx -y charted-sea-mcp
```

### Docker (Streamable HTTP)

```sh
docker build -t charted-sea-mcp .
docker run -p 3333:3333 \
  -e CHARTED_SEA_TOKEN=<your token> \
  -e MCP_HTTP_TOKEN=$(openssl rand -hex 24) \
  charted-sea-mcp
```

The image is distroless, runs as `nonroot` (about 56 MB), and has a `/healthz` health check. Point an MCP client at `http://<host>:3333/mcp` and send `Authorization: Bearer <MCP_HTTP_TOKEN>`.

## Usage

Once it's connected, ask your agent in plain language. For example:

> Check Shopee health in Singapore and Indonesia for the last hour. If search is healthy, fetch the first results page for "tshirt" on shopee.sg and tell me the top 5 item names and prices.

A typical agent run:

1. `check_platform_health` with `scrapers: ["SHOPEE"]`, `countries: ["SG","ID"]`. SG `PRODUCT_SEARCH` is `go`, ID is `wait`.
2. `run_scraping_tasks` with `scraper: "shopee"` and `requests: [{ url: "https://shopee.sg/api/v4/search/search_items?keyword=tshirt" }]`. The task finishes within the wait and returns a body preview.
3. If the preview was truncated, the agent reads `charted-sea://tasks/shopee/<uuid>` for the full body.

To try the tools without an agent, use the MCP Inspector:

```sh
CHARTED_SEA_TOKEN=<your token> npm run inspect
```

## Configuration

All settings are environment variables.

| Variable | Default | Purpose |
|---|---|---|
| `CHARTED_SEA_TOKEN` | required | API token from the Charted Sea console |
| `CHARTED_SEA_MAX_TASKS_PER_SESSION` | `50` | Spend guard: submissions allowed per server process |
| `CHARTED_SEA_MAX_BODY_CHARS` | `20000` | Inline body preview size (the full body stays a resource) |
| `CHARTED_SEA_MAX_WAIT_SEC` | `300` | Longest a tool call waits for results |
| `CHARTED_SEA_HEALTH_GO` / `CHARTED_SEA_HEALTH_WAIT` | `0.8` / `0.5` | Success-rate thresholds for `go` and `wait` |
| `CHARTED_SEA_BASE_URL` | Charted Sea API | Override the API host (testing) |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_HTTP_HOST` / `MCP_HTTP_PORT` | `127.0.0.1` / `3333` | Where HTTP listens (`/mcp`, plus `/healthz`) |
| `MCP_HTTP_TOKEN` | required for http | Bearer token clients must send; separate from the Charted Sea token; at least 16 characters |
| `MCP_ALLOWED_ORIGINS` | empty | Extra allowed browser `Origin`s, comma-separated; localhost is always allowed |

The server fails fast with a readable message if a setting is missing or invalid. Logs are structured JSON on stderr, with secrets redacted; stdout is the MCP protocol channel.

## Security

- The spend guard and the wait cap are enforced in code, not left to the agent ([ADR 0002](docs/adr/0002-spend-guard-and-bounded-waits.md)).
- HTTP mode binds to `127.0.0.1` by default. It requires its own bearer token (compared in constant time) and rejects foreign `Origin` headers.
- See [SECURITY.md](SECURITY.md) for how secrets are handled and how to report a vulnerability.

## How it's tested

- **61 tests at 100% coverage per file**, on Node 20, 22 and 24.
- Protocol tests connect a real MCP client to the server.
- Transport tests check auth, `Origin` and `/healthz` over real HTTP.
- CI starts the packed package over stdio and lists its tools with the official MCP Inspector. It also builds the Docker image and checks `/healthz`, `tools/list` over HTTP, the 401 without a token, and the non-root user.
- A live smoke test calls the real API through the tool handlers.

## Documentation

[Spec](docs/SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Requirements](docs/REQUIREMENTS.md) · [Test strategy](docs/TEST_STRATEGY.md) · [CI/CD](docs/CI_CD.md) · [Release process](docs/RELEASE_PROCESS.md) · [Roadmap](docs/ROADMAP.md) · [ADRs](docs/adr/) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Related

- [charted-sea-client](https://github.com/ayenisholah/charted-sea-client): the TypeScript client this server is built on (on npm).
- [charted-sea-rs](https://github.com/ayenisholah/charted-sea-rs): the same client in Rust.

## Licence

[MIT](LICENSE)
