# 0001: Build on charted-sea-client

**Status:** Accepted

## Context
The MCP server needs every API behaviour the client already has: async runs, polling, batching, retry policy, redaction.

## Decision
All Charted Sea HTTP goes through `charted-sea-client`. This repo contains no `fetch` calls (enforced by an ESLint rule).

## Consequences
- One place to fix API behaviour, and the MCP server inherits the no-double-submit retry policy.
- Releases are ordered: a client change the server needs ships first.
