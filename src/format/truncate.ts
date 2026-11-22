/**
 * Cuts `text` to at most `max` UTF-16 code units without splitting a surrogate pair.
 * `truncated` is true exactly when something was cut.
 */
export function truncate(text: string, max: number): { preview: string; truncated: boolean } {
  if (text.length <= max) return { preview: text, truncated: false };
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (end > 0 && last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { preview: text.slice(0, end), truncated: true };
}
