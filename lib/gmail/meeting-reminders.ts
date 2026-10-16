import "server-only";
import { revalidateTag } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { remindersTag } from "@/lib/data/reminders";

export type MeetingInvite = {
  gmailMessageId: string;
  uid: string;
  title: string;
  startsAt: Date | null;
  notes: string | null;
  action: "invite" | "cancel" | "other";
};

/**
 * Calendar invites become reminders by themselves, alerting `leadMinutes`
 * before. One reminder per meeting, enforced by the unique (user, event_uid)
 * index: an updated invite moves its reminder, the same invite arriving in a
 * second Gmail changes nothing, and a cancelled invite cancels it.
 * `invites` are oldest first, so the latest email about a meeting wins.
 */
export async function remindMeetings(userId: string, invites: MeetingInvite[], timezone: string, leadMinutes: number) {
  const latest = [...new Map(invites.map((i) => [i.uid, i])).values()];
  const cancelled = latest.filter((i) => i.action === "cancel").map((i) => i.uid);
  const upcoming = latest.filter(
    (i): i is MeetingInvite & { startsAt: Date } => i.action === "invite" && Boolean(i.title) && i.startsAt !== null && i.startsAt.getTime() > Date.now(),
  );
  let changed = false;

  // At most three statements, however many invites arrived.
  if (cancelled.length) {
    const rows = await db
      .update(reminders)
      .set({ status: "cancelled" })
      .where(and(eq(reminders.userId, userId), inArray(reminders.eventUid, cancelled), eq(reminders.status, "pending")))
      .returning({ id: reminders.id });
    changed = rows.length > 0;
  }

  if (upcoming.length) {
    // Same time as before: keep its state (done, already sent). A new time, or a
    // meeting cancelled earlier and invited again: pending, so it alerts again.
    // The user's own alert time on an existing reminder is kept.
    const keep = sql`(${reminders.remindAt} = excluded.remind_at and ${reminders.status} <> 'cancelled')`;
    const saved = await db
      .insert(reminders)
      .values(
        upcoming.map((i) => ({
          userId,
          title: i.title.slice(0, 200),
          notes: i.notes,
          remindAt: i.startsAt,
          notifyAt: new Date(i.startsAt.getTime() - leadMinutes * 60_000),
          leadMinutes,
          timezone,
          source: "gmail" as const,
          eventUid: i.uid,
        })),
      )
      .onConflictDoUpdate({
        target: [reminders.userId, reminders.eventUid],
        targetWhere: sql`${reminders.eventUid} is not null`,
        set: {
          title: sql`excluded.title`,
          notes: sql`excluded.notes`,
          remindAt: sql`excluded.remind_at`,
          notifyAt: sql`excluded.remind_at - make_interval(mins => ${reminders.leadMinutes})`,
          status: sql`case when ${keep} then ${reminders.status} else 'pending' end`,
          notifiedAt: sql`case when ${keep} then ${reminders.notifiedAt} else null end`,
          pushSent: sql`case when ${keep} then ${reminders.pushSent} else false end`,
        },
      })
      .returning({ id: reminders.id, eventUid: reminders.eventUid });

    // Each invite email becomes "Added" and links to its reminder, in one UPDATE.
    const reminderOf = new Map(saved.map((r) => [r.eventUid, r.id]));
    const links = upcoming.map((i) => sql`(${i.gmailMessageId}, ${reminderOf.get(i.uid)}::uuid)`);
    await db.execute(sql`
      update email_items e
         set status = 'added', reminder_id = v.reminder_id, updated_at = now()
        from (values ${sql.join(links, sql`, `)}) as v(gmail_message_id, reminder_id)
       where e.user_id = ${userId} and e.gmail_message_id = v.gmail_message_id
    `);
    changed = true;
  }

  if (changed) {
    try {
      revalidateTag(remindersTag(userId), { expire: 0 });
    } catch (error) {
      console.warn("gmail.reminders_revalidate_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  }
}
