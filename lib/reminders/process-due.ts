import "server-only";
import { inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { remindersTag } from "@/lib/data/reminders";
import { pushToUser } from "@/lib/push/service";
import { formatClockTime } from "@/lib/time";

/** Reminders handled per cron run; the rest wait for the next run. */
const BATCH = 200;

/** A push that cannot be delivered within 30 minutes is no longer useful. */
const PUSH_TTL_SECONDS = 30 * 60;

export function cronIntervalMinutes(): number {
  const n = Number(process.env.REMINDER_CRON_INTERVAL_MINUTES ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/**
 * Sends every reminder due before the next cron run (so they are never late,
 * at most one interval early).
 *
 * The claim is one UPDATE (pattern from email-automation's reminderService):
 * the subquery picks the batch, and the repeated outer `notified_at is null`
 * is checked again per row at update time, so two overlapping runs can never
 * claim, and send, the same reminder.
 */
export async function processDueReminders() {
  const interval = cronIntervalMinutes();
  const claimed = await db.execute<{ id: string }>(sql`
    update reminders
       set notified_at = now(), updated_at = now()
     where id in (
             select id from reminders
              where status = 'pending'
                and notified_at is null
                and notify_at <= now() + make_interval(mins => ${interval})
              order by notify_at
              limit ${BATCH}
           )
       and notified_at is null
    returning id
  `);
  const ids = claimed.map((r) => r.id);
  const result = { claimed: ids.length, pushed: 0, noDevice: 0 };
  if (ids.length === 0) return result;

  const rows = await db
    .select({
      id: reminders.id,
      userId: reminders.userId,
      title: reminders.title,
      notes: reminders.notes,
      remindAt: reminders.remindAt,
      timezone: reminders.timezone,
    })
    .from(reminders)
    .where(inArray(reminders.id, ids));

  const delivered: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      const at = formatClockTime(r.remindAt, r.timezone);
      const count = await pushToUser(
        r.userId,
        {
          type: "reminder",
          title: r.title,
          body: r.notes ? `${at}. ${r.notes}` : `Due at ${at}`,
          tag: `reminder-${r.id}`,
          url: `/reminders?r=${r.id}`,
        },
        PUSH_TTL_SECONDS,
      );
      if (count > 0) delivered.push(r.id);
    }),
  );

  if (delivered.length > 0) {
    await db.update(reminders).set({ pushSent: true }).where(inArray(reminders.id, delivered));
  }
  // Lists show "Sent" now. expire 0: the next view (often the notification
  // tap) gets fresh data instead of a stale "Scheduled".
  for (const userId of new Set(rows.map((r) => r.userId))) {
    revalidateTag(remindersTag(userId), { expire: 0 });
  }

  result.pushed = delivered.length;
  result.noDevice = rows.length - delivered.length;
  return result;
}
