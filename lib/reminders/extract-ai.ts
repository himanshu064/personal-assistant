import "server-only";
import { z } from "zod";
import { toLocalInputValue } from "@/lib/time";
import { REPEAT_OPTIONS } from "@/lib/reminders/repeat";
import { clampAlertCount, snapLeadMinutes, type ReminderDraft } from "@/lib/validation/reminders";

/** A reminder as the model returns it. Shared with the assistant, which fills the same shape. */
export const draftSchema = z.object({
  title: z.string().describe("Short imperative title, for example 'Call Ravi'. No date or time words."),
  localDateTime: z
    .string()
    .nullable()
    .describe("When to remind, as YYYY-MM-DDTHH:mm in the user's local time. Null if no time can be inferred."),
  notes: z.string().describe("Any extra details from the text that are not in the title. Empty string if none."),
  leadMinutes: z
    .number()
    .int()
    // The number the user said; the app rounds it up to an available alert option.
    .describe("Minutes before the time to alert, only if the user asked for it (for example '10 minutes before' is 10, 'an hour before' is 60). Otherwise 0."),
  alertCount: z
    .number()
    .int()
    .describe("How many times to alert, only if the user asked (for example 'remind me 3 times' is 3). Otherwise 0."),
  repeat: z
    .enum(REPEAT_OPTIONS)
    .describe(
      "How it repeats, only if the user said so: 'every day' daily, 'every weekday' or 'Monday to Friday' weekdays, 'every Monday' weekly (localDateTime on the next Monday), 'every month' monthly, 'every year' or 'birthday' yearly. Otherwise none.",
    ),
});

/**
 * The current local time plus the next 14 dates with their weekdays, for the
 * prompt. Models often get "next Friday" wrong when they work out the date
 * themselves; with the dates written out they only have to look it up.
 */
export function timeContext(timeZone: string, now: Date = new Date()): string {
  const localNow = toLocalInputValue(now, timeZone);
  const [y, m, d] = localNow.slice(0, 10).split("-").map(Number);
  // Counted on calendar dates (in UTC), so a daylight saving change never skips or repeats a day.
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const name = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(day);
    return `${name} ${day.toISOString().slice(0, 10)}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""}`;
  });
  return `Current local time: ${days[0].split(" ")[0]}, ${localNow} (${timeZone}).\nThe next 14 days: ${days.join(", ")}.`;
}

/** Checks what the model returned: an unknown alert time becomes 0, a malformed time becomes "" (the user picks one). */
export function draftFromOutput(output: z.infer<typeof draftSchema>): ReminderDraft {
  const lead = snapLeadMinutes(output.leadMinutes);
  const remindAt = output.localDateTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(output.localDateTime) ? output.localDateTime : "";
  return { title: output.title.trim(), remindAt, notes: output.notes.trim(), leadMinutes: lead, alertCount: clampAlertCount(output.alertCount), repeat: output.repeat, via: "ai" };
}
