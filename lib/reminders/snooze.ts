import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";

export const SNOOZE_PRESETS = ["15m", "1h", "tomorrow"] as const;
export type SnoozePreset = (typeof SNOOZE_PRESETS)[number];

/**
 * Moves the reminder later and re-arms it, in one UPDATE. "tomorrow" is 9:00
 * tomorrow in the reminder's own timezone, worked out by Postgres. Times are
 * rounded to the minute so later edits compare cleanly. A snoozed reminder
 * alerts once, at the new time itself, so the lead time is cleared.
 * Used by the Snooze menu and the notification's Snooze button.
 */
export async function snoozeReminderFor(userId: string, reminderId: string, preset: SnoozePreset): Promise<boolean> {
  const newTime =
    preset === "tomorrow"
      ? sql`((date_trunc('day', now() at time zone ${reminders.timezone}) + interval '1 day 9 hours') at time zone ${reminders.timezone})`
      : sql`date_trunc('minute', now() + ${preset === "15m" ? "15 minutes" : "1 hour"}::interval)`;

  const updated = await db
    .update(reminders)
    .set({
      remindAt: newTime,
      notifyAt: newTime,
      leadMinutes: 0,
      alertsSent: sql`${reminders.alertCount} - 1`,
      status: "pending",
      notifiedAt: null,
      pushSent: false,
    })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning({ id: reminders.id });
  return updated.length > 0;
}
