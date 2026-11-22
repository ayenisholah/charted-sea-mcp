import { redact } from "charted-sea-client";

/** Structured JSON logs on stderr only: stdout is the stdio protocol channel (NFR-4). */
export function createLogger(secrets: readonly string[], write: (line: string) => void) {
  return (event: string, meta: Record<string, unknown> = {}): void => {
    write(
      `${redact(JSON.stringify({ time: new Date().toISOString(), event, ...meta }), secrets)}\n`,
    );
  };
}
