import {
  AbortError,
  AuthError,
  ChartedSeaError,
  NetworkError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
} from "charted-sea-client";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { describeError } from "../../src/format/errors.js";
import { fail, ok, UNTRUSTED_NOTICE } from "../../src/format/result.js";
import { truncate } from "../../src/format/truncate.js";
import { TOKEN } from "../support/fakes.js";

describe("truncate", () => {
  it("FR-4 property: preview ≤ limit, truncated iff cut, never a lone high surrogate at the end", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), fc.integer({ min: 1, max: 50 }), (text, max) => {
        const { preview, truncated } = truncate(text, max);
        expect(preview.length).toBeLessThanOrEqual(max);
        expect(truncated).toBe(preview.length < text.length);
        expect(text.startsWith(preview)).toBe(true);
        const last = preview.charCodeAt(preview.length - 1);
        expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
      }),
    );
  });

  it("backs off one unit instead of splitting an emoji", () => {
    expect(truncate("ab😀", 3)).toEqual({ preview: "ab", truncated: true });
    expect(truncate("abc", 3)).toEqual({ preview: "abc", truncated: false });
  });
});

describe("results", () => {
  it("NFR-2: puts the untrusted notice first when asked", () => {
    const r = ok("2 SUCCESS.", { a: 1 }, { untrusted: true });
    expect((r.content[0] as { text: string }).text.startsWith(UNTRUSTED_NOTICE)).toBe(true);
    expect(r.structuredContent).toEqual({ a: 1 });
    expect((ok("x", {}).content[0] as { text: string }).text.startsWith("x\n\n{}")).toBe(true);
    expect(fail("nope")).toEqual({ isError: true, content: [{ type: "text", text: "nope" }] });
  });
});

describe("describeError", () => {
  it.each([
    [new AuthError("x", { status: 401 }), /rejected the token \(401\)\. Check CHARTED_SEA_TOKEN/],
    [new RateLimitError("x", { retryAfterMs: 2_500 }), /Retry in 3 s/],
    [new RateLimitError("x", {}), /Retry in a moment/],
    [new ValidationError("bad input"), /rejected the request: bad input/],
    [new ServerError("x", { status: 503 }), /server error \(503\)/],
    [new NetworkError("x", { maybeSubmitted: true }), /may have been submitted/],
    [
      new TimeoutError("x", { maybeSubmitted: false }),
      /^Couldn't reach Charted Sea \(TimeoutError\)\.$/,
    ],
    [new AbortError("x"), /cancelled/],
    [new ChartedSeaError("other"), /^other$/],
    [new TypeError("boom"), /Unexpected error/],
  ])("gives an actionable message for %o", (error, message) => {
    expect(describeError(error, [TOKEN])).toMatch(message);
  });

  it("NFR-1: redacts the token from messages it passes through", () => {
    expect(describeError(new ValidationError(`bad ${TOKEN}`), [TOKEN])).not.toContain(TOKEN);
    expect(describeError(new ChartedSeaError(`x ${TOKEN}`), [TOKEN])).not.toContain(TOKEN);
  });
});
