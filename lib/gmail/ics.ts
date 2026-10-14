import { fromLocalInputValue, toLocalInputValue } from "@/lib/time";
import { isValidTimezone } from "@/lib/validation/settings";

export type InviteEvent = {
  /** The event's id in the organiser's calendar. Updates and cancellations reuse it. */
  uid: string | null;
  title: string;
  /** The start, or for a repeating event the next start from now. */
  startsAt: Date | null;
  location: string | null;
  description: string;
  repeats: boolean;
  /**
   * What the email is: "invite" (a new or updated meeting), "cancel" (called
   * off), or "other" (a reply such as "Accepted", which is not for the user to attend).
   */
  action: "invite" | "cancel" | "other";
};

/** Undoes iCalendar line folding (a line starting with a space or tab continues the one before). */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

/** Splits "NAME;PARAM=x:VALUE" at the first colon that is not inside quotes. */
function splitLine(line: string): { name: string; params: string; value: string } | null {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      const [name, ...params] = line.slice(0, i).split(";");
      return { name: name.toUpperCase(), params: params.join(";"), value: line.slice(i + 1) };
    }
  }
  return null;
}

/**
 * A DTSTART line as a local wall time plus timezone. Handles UTC
 * ("20261020T093000Z"), local with a timezone ("TZID=Asia/Kolkata:20261020T150000"),
 * and a whole day ("VALUE=DATE:20261020", treated as 09:00). Unknown timezone
 * names (Outlook sends "India Standard Time" or "(UTC+05:30) Chennai...")
 * fall back to the user's timezone.
 */
function parseStart(line: string, userTimezone: string): { local: string; timeZone: string } | null {
  // The date never contains a colon, but an unquoted Outlook TZID can ("(UTC+05:30)"), so the date is after the LAST colon.
  const value = line.slice(line.lastIndexOf(":") + 1).trim();
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , utc] = m;
  if (utc) return { local: toLocalInputValue(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), userTimezone), timeZone: userTimezone };
  const tzid = line.match(/TZID=("?)([^";:]+)\1[;:]/i)?.[2]?.trim();
  return { local: `${y}-${mo}-${d}T${h ?? "09"}:${mi ?? "00"}`, timeZone: tzid && isValidTimezone(tzid) ? tzid : userTimezone };
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * The next start at or after `now` of a repeating event, from its RRULE.
 * Supports DAILY, WEEKLY (with BYDAY), MONTHLY and YEARLY with INTERVAL,
 * COUNT and UNTIL, which covers normal meeting series. Steps in the event's
 * own wall time, so the hour stays right across daylight saving changes.
 * Returns null when the series has ended.
 */
export function nextOccurrence(startLocal: string, timeZone: string, rrule: string, now: Date): Date | null {
  const rule = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  const until = rule.UNTIL ? parseUntil(rule.UNTIL) : null;
  const byDay = (rule.BYDAY ?? "").split(",").map((d) => d.replace(/^[+-]?\d+/, "")).filter((d) => WEEKDAYS.includes(d));

  const [datePart, time] = startLocal.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const first = Date.UTC(y, mo - 1, d); // the calendar date only; wall time is added per candidate
  const at = (dayMs: number) => fromLocalInputValue(`${new Date(dayMs).toISOString().slice(0, 10)}T${time}`, timeZone);

  let seen = 0;
  const DAY = 86_400_000;
  // Bounded walk: about 3 years of days, or 400 months and years.
  for (let step = 0; step < 1200; step++) {
    let candidates: number[];
    if (freq === "DAILY") candidates = [first + step * interval * DAY];
    else if (freq === "WEEKLY") {
      // Each week of the series (every `interval` weeks), on the listed days, or the start's own weekday.
      const weekStart = first - new Date(first).getUTCDay() * DAY + step * interval * 7 * DAY;
      const days = byDay.length ? byDay.map((w) => WEEKDAYS.indexOf(w)) : [new Date(first).getUTCDay()];
      candidates = days.sort((a, b) => a - b).map((w) => weekStart + w * DAY).filter((t) => t >= first);
    } else if (freq === "MONTHLY" || freq === "YEARLY") {
      const months = freq === "MONTHLY" ? step * interval : step * interval * 12;
      const c = new Date(Date.UTC(y, mo - 1 + months, d));
      // Skip months without this day (the 31st in a 30 day month), as calendars do.
      candidates = c.getUTCDate() === d ? [c.getTime()] : [];
      if (step > 400) break;
    } else return null;

    for (const dayMs of candidates) {
      const start = at(dayMs);
      if (!start) continue;
      if (until && start > until) return null;
      if (++seen > count) return null;
      if (start >= now) return start;
    }
  }
  return null;
}

function parseUntil(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59, m[6] ? +m[6] : 59));
}

/** The first event in an .ics file, or null when there is none. */
export function parseInvite(ics: string, userTimezone: string, now: Date = new Date()): InviteEvent | null {
  const lines = unfold(ics);
  let method = "";
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) break;
    const parts = splitLine(line);
    if (parts?.name === "METHOD") method = parts.value.trim().toUpperCase();
  }
  const start = lines.findIndex((l) => /^BEGIN:VEVENT/i.test(l));
  if (start === -1) return null;

  // REQUEST (an invite or an update) and PUBLISH (a shared event) are for the user;
  // REPLY ("Accepted: ...") and COUNTER are answers to their own invites.
  const action: InviteEvent["action"] = method === "CANCEL" ? "cancel" : method === "" || method === "REQUEST" || method === "PUBLISH" ? "invite" : "other";
  const event: InviteEvent = { uid: null, title: "", startsAt: null, location: null, description: "", repeats: false, action };
  let begins: { local: string; timeZone: string } | null = null;
  let rrule = "";

  for (const line of lines.slice(start + 1)) {
    if (/^END:VEVENT/i.test(line)) break;
    const parts = splitLine(line);
    if (!parts) continue;
    switch (parts.name) {
      case "UID":
        event.uid = parts.value.trim().slice(0, 300) || null;
        break;
      case "SUMMARY":
        event.title = unescapeText(parts.value);
        break;
      case "DTSTART":
        begins = parseStart(line, userTimezone);
        break;
      case "RRULE":
        rrule = parts.value.trim().toUpperCase();
        break;
      case "LOCATION":
        event.location = unescapeText(parts.value) || null;
        break;
      case "DESCRIPTION":
        event.description = unescapeText(parts.value);
        break;
      case "STATUS":
        if (parts.value.trim().toUpperCase() === "CANCELLED") event.action = "cancel";
        break;
    }
  }

  if (begins) {
    const first = fromLocalInputValue(begins.local, begins.timeZone);
    event.repeats = Boolean(rrule);
    // A finished series keeps its (past) first start, so it is treated as past, not as "no date".
    event.startsAt = rrule && first && first < now ? (nextOccurrence(begins.local, begins.timeZone, rrule, now) ?? first) : first;
  }
  return event;
}
