# 0004: No proxy configuration tools

**Status:** Accepted

## Context
The API can validate and replace the account's proxy configuration. Proxy URLs contain provider credentials, `PUT /proxy-configs` replaces the whole configuration, and validation consumes proxy traffic.

## Decision
The MCP server exposes no proxy tools. Proxy management stays in the console or in code using charted-sea-client.

## Consequences
- An agent can't leak proxy credentials into a transcript or wipe a working configuration.
- Users who want agent-driven proxy checks can build them on the client deliberately.
