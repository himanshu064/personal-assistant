import "server-only";
import { inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { remindersTag } from "@/lib/data/reminders";
import { activeDevicesOf, pushToDevices } from "@/lib/push/service";
import { moveRepeatingReminders } from "./complete";
import { formatClockTime } from "@/lib/time";

/** Reminders handled per cron run; the rest wait for the next run. */
const BATCH = 200;

/** A push that cannot be delivered within 30 minutes is no longer useful. */
const PUSH_TTL_SECONDS = 30 * 60;

/** How often cron-job.org calls the reminders job. Defaults to 15, the agreed schedule, if the env value is missing. */
export function cronIntervalMinutes(): number {
  const n = Number(process.env.REMINDER_CRON_INTERVAL_MINUTES ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

/**
 * Sends every reminder due before the next cron run (so they are never late,
 * at most one interval early). Strictly before: an alert exactly at the next
 * run's time (5:00 when this run is 4:45) waits for that run and arrives on
 * time, instead of a whole interval early. The minute is rounded down because
 * the cron fires a few seconds after :00, :15, :30, :45.
 *
 * The claim is one UPDATE (pattern from email-automation's reminderService):
 * the subquery picks the batch, and the repeated outer `notified_at is null`
 * is checked again per row at update time, so two overlapping runs can never
 * claim, and send, the same reminder.
 */
export async function processDueReminders() {
  const interval = cronIntervalMinutes();
  // Repeating reminders whose time has passed move to their next date first.
  for (const userId of await moveRepeatingReminders()) revalidateTag(remindersTag(userId), { expire: 0 });

  // One alert per claim. When more alerts are left (repeats), the same UPDATE moves
  // notify_at 15 minutes on and leaves notified_at empty, so a later run sends the
  // next one; the outer conditions are checked again per row, so an overlapping
  // run never sends the same alert twice. Done or cancelled reminders stop.
  const claimed = await db.execute<{ id: string; alert_number: number; alert_count: number }>(sql`
    update reminders
       set alerts_sent = alerts_sent + 1,
           notified_at = case when alerts_sent + 1 < alert_count then null else now() end,
           notify_at = case when alerts_sent + 1 < alert_count then notify_at + interval '15 minutes' else notify_at end,
           updated_at = now()
     where id in (
             select id from reminders
              where status = 'pending'
                and notified_at is null
                and notify_at < date_trunc('minute', now()) + make_interval(mins => ${interval})
              order by notify_at
              limit ${BATCH}
           )
       and status = 'pending'
       and notified_at is null
       and notify_at < date_trunc('minute', now()) + make_interval(mins => ${interval})
    returning id, alerts_sent as alert_number, alert_count
  `);
  const alertOf = new Map(claimed.map((r) => [r.id, r]));
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

  // Every user's devices in one query, not one query per reminder.
  const devices = await activeDevicesOf([...new Set(rows.map((r) => r.userId))]);

  const delivered: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      const at = formatClockTime(r.remindAt, r.timezone);
      const alert = alertOf.get(r.id);
      const repeat = alert && alert.alert_count > 1 ? ` (reminder ${alert.alert_number} of ${alert.alert_count})` : "";
      const count = await pushToDevices(
        devices.get(r.userId) ?? [],
        {
          type: "reminder",
          title: r.title,
          body: (r.notes ? `${at}. ${r.notes}` : `Due at ${at}`) + repeat,
          // Same tag for every alert of a reminder: each one replaces the last on screen (and still rings).
          tag: `reminder-${r.id}`,
          id: r.id,
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
