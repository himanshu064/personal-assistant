import "server-only";
import { and, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { DEFAULT_LEAD_MINUTES } from "@/lib/validation/reminders";
import { nextOccurrence } from "./repeat";
import { alertSchedule } from "./schedule";

type RepeatingRow = {
  id: string;
  remindAt: Date;
  timezone: string;
  leadMinutes: number;
  alertCount: number;
  repeat: "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
  repeatAnchor: Date | null;
  /** The user's own "Alert me" setting, for a reminder whose alert time a snooze cleared. */
  userLeadMinutes: number;
};

const rowColumns = {
  id: reminders.id,
  remindAt: reminders.remindAt,
  timezone: reminders.timezone,
  leadMinutes: reminders.leadMinutes,
  alertCount: reminders.alertCount,
  repeat: reminders.repeat,
  repeatAnchor: reminders.repeatAnchor,
  userLeadMinutes: sql<number>`coalesce((select default_lead_minutes from user_settings where user_id = ${reminders.userId}), ${DEFAULT_LEAD_MINUTES})`.mapWith(Number),
};

/**
 * Moves a repeating reminder to its next date and re-arms its alerts.
 * A snooze cleared the "Alert me" time (0); the next date gets the user's own setting back.
 * `guard` keeps two runs from moving the same reminder twice.
 */
async function moveToNext(row: RepeatingRow, guard?: ReturnType<typeof sql>) {
  const next = nextOccurrence(row.repeat, row.remindAt, row.repeatAnchor ?? row.remindAt, row.timezone);
  if (!next) return null;
  const leadMinutes = row.leadMinutes || row.userLeadMinutes;
  const updated = await db
    .update(reminders)
    .set({
      remindAt: next,
      leadMinutes,
      ...alertSchedule(next, leadMinutes, row.alertCount),
      status: "pending",
      notifiedAt: null,
      pushSent: false,
    })
    .where(and(eq(reminders.id, row.id), guard))
    .returning({ id: reminders.id });
  return updated.length > 0 ? next : null;
}

/**
 * "Done": a one off reminder is done. A repeating one is done for this time
 * and moves to its next date (it stops only when set to "Does not repeat" or
 * deleted). Returns the next date for a repeating reminder.
 */
export async function completeReminder(userId: string, reminderId: string): Promise<{ found: boolean; next: Date | null }> {
  const [row] = await db
    .select(rowColumns)
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .limit(1);
  if (!row) return { found: false, next: null };
  if (row.repeat === "none") {
    await db.update(reminders).set({ status: "done" }).where(eq(reminders.id, row.id));
    return { found: true, next: null };
  }
  return { found: true, next: await moveToNext(row) };
}

/**
 * Cron: repeating reminders whose time has passed and whose alerts are all
 * sent move to their next date. Returns the users touched (their lists need
 * refreshing).
 */
export async function moveRepeatingReminders(limit = 200): Promise<Set<string>> {
  const due = await db
    .select({ ...rowColumns, userId: reminders.userId })
    .from(reminders)
    .where(and(eq(reminders.status, "pending"), ne(reminders.repeat, "none"), isNotNull(reminders.notifiedAt), lt(reminders.remindAt, sql`now()`)))
    .limit(limit);
  const users = new Set<string>();
  for (const row of due) {
    if (await moveToNext(row, sql`${reminders.notifiedAt} is not null`)) users.add(row.userId);
  }
  return users;
}
