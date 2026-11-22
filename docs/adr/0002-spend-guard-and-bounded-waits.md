# 0002: Spend guard and bounded waits

**Status:** Accepted

## Context
Successful tasks cost credits, and agents can loop or fan out. A tool call that blocks for the API's default 10 minutes also stalls the agent.

## Decision
- A per-process budget (`CHARTED_SEA_MAX_TASKS_PER_SESSION`, default 50) caps submissions. Over-budget calls fail with the remaining count; the user raises the limit deliberately.
- At most 20 requests per call.
- `cacheMaxAgeInSec` defaults to 3600 so repeated agent requests for the same URL hit the cache (not billed).
- Waits are capped at `CHARTED_SEA_MAX_WAIT_SEC` (default 300); unfinished tasks come back with their UUIDs.

## Consequences
- Large jobs need several calls or a higher budget, which is the point.
- The budget resets when the server restarts. Persisting it is out of scope until someone needs it.
