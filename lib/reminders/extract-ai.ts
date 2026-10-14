import "server-only";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { toLocalInputValue } from "@/lib/time";
import { LEAD_TIME_OPTIONS, type ReminderDraft } from "@/lib/validation/reminders";

const draftSchema = z.object({
  title: z.string().describe("Short imperative title, for example 'Call Ravi'. No date or time words."),
  localDateTime: z
    .string()
    .nullable()
    .describe("When to remind, as YYYY-MM-DDTHH:mm in the user's local time. Null if no time can be inferred."),
  notes: z.string().describe("Any extra details from the text that are not in the title. Empty string if none."),
  leadMinutes: z
    .number()
    .int()
    .describe(`Minutes before the time to alert, only if the user asked for it (for example '10 minutes before'). One of ${LEAD_TIME_OPTIONS.join(", ")}. Otherwise 0.`),
});

/**
 * Turns spoken text into a reminder draft with the user's own model. The
 * model gets the current local time so "next Friday 5pm" resolves correctly.
 * The result is only a draft: the preview card shows it and the server
 * validates again on save.
 */
export async function extractReminderWithAi(
  model: LanguageModel,
  text: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<ReminderDraft> {
  const localNow = toLocalInputValue(now, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now);

  const { output } = await generateText({
    model,
    output: Output.object({ schema: draftSchema }),
    maxRetries: 1,
    system:
      "You turn a short spoken note into a single reminder. " +
      "Resolve relative dates against the current local time given. " +
      "If only a day is given, use 09:00. Never invent details that are not in the text.",
    prompt: `Current local time: ${weekday}, ${localNow} (${timeZone}).\nNote: """${text}"""`,
  });

  const lead = (LEAD_TIME_OPTIONS as readonly number[]).includes(output.leadMinutes) ? output.leadMinutes : 0;
  const remindAt = output.localDateTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(output.localDateTime) ? output.localDateTime : "";

  return { title: output.title.trim(), remindAt, notes: output.notes.trim(), leadMinutes: lead, via: "ai" };
}
