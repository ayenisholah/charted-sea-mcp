# Roadmap

Starts after charted-sea-client M1.

## M0: Scaffold and CI (0.5 day) ✅ done
**Done when:** `list_scrapers` works end to end over stdio and in-memory transport, all CI jobs are green, and the Inspector smoke step lists it.

## M1: Core tools (1 day) ✅ done
`check_platform_health`, `run_scraping_tasks`, `get_task_results`, spend guard, truncation, resource template.
**Done when:** FR-1 to FR-4 and NFR-1, NFR-2, NFR-4 pass at 100% coverage, and a recorded session in Claude Code checks health and fetches a cached product page.

## M2: Remaining tools, HTTP and polish (1 day) ✅ done (Claude Code/Cursor recordings still to do)
`count_tasks`, `cancel_tasks`, Streamable HTTP transport, rate limiter, read cache, Docker image, install docs for Claude Code and Cursor, first live smoke run.
**Done when:** FR-5, FR-6 and NFR-3 pass, and the image runs with `docker run` and answers `tools/list` over HTTP.

## M3: Release 0.1.0 (0.5 day)
**Done when:** the [release checklist](RELEASE_PROCESS.md#before-the-first-publish-010) is complete and `npx -y charted-sea-mcp` works from a clean machine.
