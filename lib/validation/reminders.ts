import { z } from "zod";

export const LEAD_TIME_OPTIONS = [0, 5, 10, 15, 20, 30, 60] as const;
/** For users who never chose: 20 minutes before (the client's choice). Same as the column default. */
export const DEFAULT_LEAD_MINUTES = 20;

export const LEAD_TIME_LABELS: Record<number, string> = {
  0: "At the time",
  5: "5 minutes before",
  10: "10 minutes before",
  15: "15 minutes before",
  20: "20 minutes before",
  30: "30 minutes before",
  60: "1 hour before",
};

/** What the preview card edits and saves. `remindAt` is a datetime-local value in the user's timezone. */
export const reminderFormSchema = z.object({
  title: z.string().trim().min(1, "Add a short title.").max(200, "Keep the title under 200 characters."),
  remindAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Choose a date and time."),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters."),
  leadMinutes: z.coerce.number().int().refine((v) => (LEAD_TIME_OPTIONS as readonly number[]).includes(v), "Choose a valid option."),
});
export type ReminderFormInput = z.input<typeof reminderFormSchema>;
export type ReminderFormValues = z.output<typeof reminderFormSchema>;

/** Text spoken or typed by the user, to be turned into a draft. */
export const reminderTextSchema = z.object({
  text: z.string().trim().min(2, "Say or type what to remember.").max(1000, "That is too long for one reminder."),
  timezone: z.string().min(1),
});

/** A draft for the preview card. Never saved without the user tapping Save. */
export type ReminderDraft = {
  title: string;
  /** datetime-local value in the user's timezone, or "" when no time was found. */
  remindAt: string;
  notes: string;
  leadMinutes: number;
  /** How the draft was made, shown so users know why it might be rough. */
  via: "ai" | "rules";
};
