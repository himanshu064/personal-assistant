/**
 * Returns a query string with `updates` applied to `current`. A null,
 * undefined or empty value removes the key.
 */
export function withSearchParams(
  current: { toString(): string },
  updates: Record<string, string | number | null | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next.toString();
}
