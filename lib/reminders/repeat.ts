import { fromLocalInputValue, toLocalInputValue } from "@/lib/time";

export const REPEAT_OPTIONS = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEAT_OPTIONS)[number];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** Parts of a datetime-local value ("2026-10-16T16:40"). */
function partsOf(local: string) {
  const [y, mo, d, h, mi] = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)!.slice(1).map(Number);
  return { y, mo, d, h, mi };
}

/**
 * The repeat choices, worded like Google Calendar for the chosen date:
 * "Weekly on Friday", "Monthly on the 16th", "Yearly on 16 October".
 * `local` is the reminder's datetime-local value; without one, plain words.
 */
export function repeatLabel(repeat: Repeat, local?: string): string {
  const p = local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local) ? partsOf(local) : null;
  const weekday = p ? WEEKDAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()] : null;
  switch (repeat) {
    case "none":
      return "Does not repeat";
    case "daily":
      return "Daily";
    case "weekdays":
      return "Every weekday (Monday to Friday)";
    case "weekly":
      return weekday ? `Weekly on ${weekday}` : "Weekly";
    case "monthly":
      return p ? `Monthly on the ${ordinal(p.d)}` : "Monthly";
    case "yearly":
      return p ? `Yearly on ${p.d} ${MONTHS[p.mo - 1]}` : "Yearly";
  }
}

function daysInMonth(y: number, mo: number) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * The next date of a repeating reminder after `after` (usually now), at the
 * same local time in its timezone. Monthly and yearly count from the first
 * date (`anchor`), so the 31st comes back after a short month and 29 February
 * after a normal year. Returns null for "none".
 */
export function nextOccurrence(repeat: Repeat, current: Date, anchor: Date, timeZone: string, after: Date = new Date()): Date | null {
  if (repeat === "none") return null;
  const a = partsOf(toLocalInputValue(anchor, timeZone));
  const floor = Math.max(current.getTime(), after.getTime());
  const at = (y: number, mo: number, d: number) => fromLocalInputValue(`${y}-${pad(mo)}-${pad(d)}T${pad(a.h)}:${pad(a.mi)}`, timeZone)!;

  if (repeat === "weekdays") {
    const c = partsOf(toLocalInputValue(current, timeZone));
    let day = Date.UTC(c.y, c.mo - 1, c.d);
    for (let i = 0; i < 400; i++) {
      day += 86_400_000;
      const date = new Date(day);
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const next = at(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      if (next.getTime() > floor) return next;
    }
    return null;
  }

  // k = 0 is the first date itself: it counts when the reminder was moved earlier than it (a snooze).
  for (let k = 0; k < 5000; k++) {
    let next: Date;
    if (repeat === "daily" || repeat === "weekly") {
      const date = new Date(Date.UTC(a.y, a.mo - 1, a.d) + k * (repeat === "daily" ? 1 : 7) * 86_400_000);
      next = at(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    } else {
      const months = repeat === "monthly" ? k : 12 * k;
      const total = a.mo - 1 + months;
      const y = a.y + Math.floor(total / 12);
      const mo = (total % 12) + 1;
      next = at(y, mo, Math.min(a.d, daysInMonth(y, mo)));
    }
    if (next.getTime() > floor) return next;
  }
  return null;
}
