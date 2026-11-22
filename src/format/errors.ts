import {
  AbortError,
  AuthError,
  ChartedSeaError,
  NetworkError,
  RateLimitError,
  redact,
  ServerError,
  TimeoutError,
  ValidationError,
} from "charted-sea-client";

/** Turns a client error into a short, redacted, actionable message for the agent. */
export function describeError(error: unknown, secrets: readonly string[]): string {
  const clean = (s: string) => redact(s, secrets);
  if (error instanceof AuthError) {
    return `Charted Sea rejected the token (${String(error.status)}). Check CHARTED_SEA_TOKEN.`;
  }
  if (error instanceof RateLimitError) {
    const wait =
      error.retryAfterMs === undefined
        ? "a moment"
        : `${String(Math.ceil(error.retryAfterMs / 1000))} s`;
    return `Charted Sea is rate limiting requests. Retry in ${wait}.`;
  }
  if (error instanceof ValidationError)
    return `Charted Sea rejected the request: ${clean(error.message)}`;
  if (error instanceof ServerError) {
    return `Charted Sea had a server error (${String(error.status)}). Retry later.`;
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    const submitted = error.maybeSubmitted
      ? " The tasks may have been submitted: check with count_tasks before resubmitting, or resubmit with cacheMaxAgeInSec to avoid paying twice."
      : "";
    return `Couldn't reach Charted Sea (${error.name}).${submitted}`;
  }
  if (error instanceof AbortError) return "The request was cancelled.";
  if (error instanceof ChartedSeaError) return clean(error.message);
  return "Unexpected error in charted-sea-mcp. See the server log.";
}
