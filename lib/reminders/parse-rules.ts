import * as chrono from "chrono-node";
import { toLocalInputValue, tzOffsetMinutes } from "@/lib/time";
import type { ReminderDraft } from "@/lib/validation/reminders";

/** Default time when the user names a day but no time ("pay rent on friday"). */
const DEFAULT_HOUR = 9;

/** Filler at the start of a spoken reminder that should not end up in the title. */
const LEADING_FILLER =
  /^(?:(?:hey|ok|okay|please|can you|could you)\s+)*(?:remind me(?:\s+to)?|set (?:a )?reminder(?:\s+to)?|reminder(?:\s+to)?|don'?t (?:let me )?forget(?:\s+to)?|i need to|i have to|i must)\s+/i;

/**
 * Free reminder parsing for users without an AI key. chrono-node finds the
 * date and time; the rest of the sentence becomes the title.
 *
 * chrono only understands numeric offsets (it silently ignores names like
 * "Asia/Kolkata"), so the timezone is converted to its offset first.
 */
export function parseReminderWithRules(text: string, timeZone: string, now: Date = new Date()): ReminderDraft {
  const [result] = chrono.parse(text, { instant: now, timezone: tzOffsetMinutes(timeZone, now) }, { forwardDate: true });

  let remindAt = "";
  let rest = text;
  if (result) {
    if (result.start.isCertain("hour")) {
      remindAt = toLocalInputValue(result.date(), timeZone);
    } else {
      // A day without a time: use DEFAULT_HOUR on that day, in the user's timezone.
      const pad = (n: number | null) => String(n ?? 0).padStart(2, "0");
      const { start } = result;
      remindAt = `${start.get("year")}-${pad(start.get("month"))}-${pad(start.get("day"))}T${pad(DEFAULT_HOUR)}:00`;
    }
    rest = text.slice(0, result.index) + " " + text.slice(result.index + result.text.length);
  }

  return { title: cleanTitle(rest) || cleanTitle(text), remindAt, notes: "", leadMinutes: 0, via: "rules" };
}

function cleanTitle(raw: string): string {
  const title = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_FILLER, "")
    // Words left dangling where the date used to be ("call Ravi at", "pay rent on").
    .replace(/\s+(?:at|on|by|in|for|this|next|the)$/i, "")
    .replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, "")
    .trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}
