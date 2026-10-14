/**
 * Timezone helpers that work the same on the server (UTC on Vercel) and in
 * the browser. Times are stored in UTC and shown in the user's timezone.
 */

/** Minutes the timezone is ahead of UTC at that moment, e.g. 330 for India. DST aware. */
export function tzOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  // "GMT" alone means UTC; otherwise "GMT+05:30" or "GMT-04:00".
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** "2026-10-15T17:00" for an <input type="datetime-local">, in the given timezone. */
export function toLocalInputValue(date: Date, timeZone: string): string {
  const local = new Date(date.getTime() + tzOffsetMinutes(timeZone, date) * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Reads a datetime-local value as a time in the given timezone and returns the UTC instant. */
export function fromLocalInputValue(value: string, timeZone: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // First guess with the offset at that wall time, then correct once in case
  // a daylight saving change falls in between.
  let instant = asUtc - tzOffsetMinutes(timeZone, new Date(asUtc)) * 60_000;
  instant = asUtc - tzOffsetMinutes(timeZone, new Date(instant)) * 60_000;
  return new Date(instant);
}

/** "Thu, Oct 15, 5:00 PM" in the given timezone. */
export function formatReminderTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "5:00 PM" in the given timezone. */
export function formatClockTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

/** "in 2 hours", "in 3 days", "5 minutes ago". */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMinutes = Math.round((date.getTime() - now.getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diffMinutes);
  if (abs < 60) return rtf.format(diffMinutes, "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(diffMinutes / 60), "hour");
  return rtf.format(Math.round(diffMinutes / (60 * 24)), "day");
}

/** True when the moment has already passed. */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}
