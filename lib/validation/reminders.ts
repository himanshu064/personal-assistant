import { z } from "zod";
import { REPEAT_OPTIONS } from "@/lib/reminders/repeat";

/**
 * Alert options offered to users. Only multiples of the 15 minute reminders
 * cron, so each is delivered exactly (for times on the quarter hour) instead
 * of rounding to the run before it. No "at the time": every reminder gets
 * some warning.
 */
export const LEAD_TIME_OPTIONS = [15, 30, 45, 60] as const;
/** Also valid on a saved reminder: 0, set by Snooze (alert at the new time itself), never offered for new ones. */
const SAVED_LEAD_VALUES: readonly number[] = [0, ...LEAD_TIME_OPTIONS];
/** For users who never chose. Same as the column default. */
export const DEFAULT_LEAD_MINUTES = 15;

export const LEAD_TIME_LABELS: Record<number, string> = {
  0: "At the time",
  15: "15 minutes before",
  30: "30 minutes before",
  45: "45 minutes before",
  60: "1 hour before",
};

/** How many alerts a reminder can get, 15 minutes apart, ending at the "Alert me" time. */
export const ALERT_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;
export const ALERT_COUNT_LABELS: Record<number, string> = { 1: "Once", 2: "2 times", 3: "3 times", 4: "4 times", 5: "5 times" };

/** A spoken "remind me 3 times" kept within 1 to 5; 0 (not said) stays 0. */
export function clampAlertCount(n: number): number {
  return !Number.isFinite(n) || n <= 0 ? 0 : Math.min(Math.round(n), 5);
}

/** A spoken "10 minutes before" becomes the next option up (15): an earlier alert is safer than none. 0 means "not said". */
export function snapLeadMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return LEAD_TIME_OPTIONS.find((o) => o >= minutes) ?? LEAD_TIME_OPTIONS[LEAD_TIME_OPTIONS.length - 1];
}

/** What the preview card edits and saves. `remindAt` is a datetime-local value in the user's timezone. */
export const reminderFormSchema = z.object({
  title: z.string().trim().min(1, "Add a short title.").max(200, "Keep the title under 200 characters."),
  remindAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Choose a date and time."),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters."),
  leadMinutes: z.coerce.number().int().refine((v) => SAVED_LEAD_VALUES.includes(v), "Choose a valid option."),
  alertCount: z.coerce.number().int().min(1, "Choose a valid option.").max(5, "Choose a valid option."),
  repeat: z.enum(REPEAT_OPTIONS),
});
export type ReminderFormInput = z.input<typeof reminderFormSchema>;
export type ReminderFormValues = z.output<typeof reminderFormSchema>;

/** Text spoken or typed by the user, to be turned into a draft. */
/** A draft for the preview card. Never saved without the user tapping Save. */
export type ReminderDraft = {
  title: string;
  /** datetime-local value in the user's timezone, or "" when no time was found. */
  remindAt: string;
  notes: string;
  leadMinutes: number;
  /** 0 when the text did not say; the user's "Remind me" setting is used then. */
  alertCount: number;
  repeat: (typeof REPEAT_OPTIONS)[number];
  /** How the draft was made, shown so users know why it might be rough. */
  via: "ai" | "rules";
};
