import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { requireUser } from "@/lib/session";

export const remindersTag = (userId: string) => `user:${userId}:reminders`;

export type ReminderView = "upcoming" | "done";

/** Columns every list needs; nothing else is read. */
const listColumns = {
  id: reminders.id,
  title: reminders.title,
  notes: reminders.notes,
  remindAt: reminders.remindAt,
  timezone: reminders.timezone,
  leadMinutes: reminders.leadMinutes,
  alertCount: reminders.alertCount,
  repeat: reminders.repeat,
  status: reminders.status,
  source: reminders.source,
  notifiedAt: reminders.notifiedAt,
};

export type ReminderRow = {
  id: string;
  title: string;
  notes: string | null;
  remindAt: Date;
  timezone: string;
  leadMinutes: number;
  alertCount: number;
  repeat: "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
  status: "pending" | "done" | "cancelled";
  source: "voice" | "text" | "gmail";
  notifiedAt: Date | null;
};

export async function getMyReminders(opts: { view: ReminderView; q: string; limit: number; offset: number }) {
  const user = await requireUser();
  return listReminders(user.id, opts.view, opts.q, opts.limit, opts.offset);
}

export async function getMyUpcomingReminders(limit = 5) {
  const user = await requireUser();
  return (await listReminders(user.id, "upcoming", "", limit, 0)).rows;
}

// Not exported: the user id always comes from the session (see getMy* above).
async function listReminders(userId: string, view: ReminderView, q: string, limit: number, offset: number) {
  "use cache";
  cacheTag(remindersTag(userId));
  cacheLife("minutes");

  const statuses = view === "upcoming" ? (["pending"] as const) : (["done", "cancelled"] as const);
  const where = and(
    eq(reminders.userId, userId),
    inArray(reminders.status, [...statuses]),
    q ? ilike(reminders.title, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : undefined,
  );

  // One query returns the page and the total (count(*) over()), using the
  // (user_id, status, remind_at) index.
  const rows = await db
    .select({ ...listColumns, total: sql<number>`count(*) over()`.mapWith(Number) })
    .from(reminders)
    .where(where)
    .orderBy(view === "upcoming" ? asc(reminders.remindAt) : desc(reminders.remindAt))
    .limit(limit)
    .offset(offset);

  const total = rows[0]?.total ?? 0;
  // The total travels on every row; it is harmless extra data for the client.
  return { rows: rows as ReminderRow[], total };
}

export type ReminderStats = { dueToday: number; upcoming: number; doneThisWeek: number };

/** Counts for the dashboard cards. `endOfToday` is the end of the user's day, in UTC. */
export async function getMyReminderStats(endOfToday: Date): Promise<ReminderStats> {
  const user = await requireUser();
  return reminderStats(user.id, endOfToday.toISOString());
}

async function reminderStats(userId: string, endOfTodayIso: string): Promise<ReminderStats> {
  "use cache";
  cacheTag(remindersTag(userId));
  cacheLife("minutes");

  // Three counts in one query (filtered aggregates), over the user's rows only.
  const [row] = await db
    .select({
      dueToday: sql<number>`count(*) filter (where ${reminders.status} = 'pending' and ${reminders.remindAt} <= ${endOfTodayIso}::timestamptz)`.mapWith(Number),
      upcoming: sql<number>`count(*) filter (where ${reminders.status} = 'pending')`.mapWith(Number),
      doneThisWeek: sql<number>`count(*) filter (where ${reminders.status} = 'done' and ${reminders.updatedAt} >= now() - interval '7 days')`.mapWith(Number),
    })
    .from(reminders)
    .where(eq(reminders.userId, userId));
  return row ?? { dueToday: 0, upcoming: 0, doneThisWeek: 0 };
}
