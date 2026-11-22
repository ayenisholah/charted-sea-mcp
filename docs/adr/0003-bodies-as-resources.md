# 0003: Truncate bodies inline, serve full bodies as resources

**Status:** Accepted

## Context
`responseBody` is raw marketplace JSON or HTML, often hundreds of kilobytes. Returning it inline fills the model's context and slows every turn.

## Decision
Tool results include a preview up to `CHARTED_SEA_MAX_BODY_CHARS` (default 20,000) and a `resourceUri`. The full task is readable through `charted-sea://tasks/{scraper}/{uuid}`, fetched on demand and never stored by the server.

## Consequences
- Agents see enough to decide whether they need the rest.
- Reading a resource makes another API call (a read, not billed).
