import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { reminderRepeatEnum, reminderSourceEnum, reminderStatusEnum } from "./enums";

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    /** The moment the reminder is for, stored in UTC. */
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    /** The user's timezone when it was created, for showing times in pushes. */
    timezone: text("timezone").notNull(),
    /** Alert this many minutes before remindAt (0 only after a snooze: alert at the new time). */
    leadMinutes: integer("lead_minutes").notNull().default(0),
    /** How many alerts, 15 minutes apart, ending at the "Alert me" time (1 to 5). */
    alertCount: integer("alert_count").notNull().default(1),
    /** Alerts already sent (or skipped because their time had passed when the reminder was saved). */
    alertsSent: integer("alerts_sent").notNull().default(0),
    /** Repeats: after its time passes (or it is marked done) it moves to the next date. See lib/reminders/repeat.ts. */
    repeat: reminderRepeatEnum("repeat").notNull().default("none"),
    /** The first date of a repeating reminder, so monthly on the 31st returns to the 31st after a short month. */
    repeatAnchor: timestamp("repeat_anchor", { withTimezone: true }),
    /**
     * When the NEXT alert goes out (see lib/reminders/schedule.ts), set on every
     * write and moved 15 minutes on after each alert while more are left.
     * Stored so the cron can use an index to find due reminders.
     */
    notifyAt: timestamp("notify_at", { withTimezone: true }).notNull(),
    status: reminderStatusEnum("status").notNull().default("pending"),
    source: reminderSourceEnum("source").notNull().default("text"),
    /** Set when the cron claims the reminder; cleared on edit or snooze so it fires again. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /** True when at least one device received the push. */
    pushSent: boolean("push_sent").notNull().default(false),
    /**
     * A calendar invite's UID when the reminder came from one. Unique per user,
     * so the same meeting (an update, or the same invite in two Gmails) never
     * makes a second reminder.
     */
    eventUid: text("event_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Lists: a user's reminders by status, in time order.
    index("reminders_user_status_remind_at_idx").on(t.userId, t.status, t.remindAt),
    // The cron: only reminders still waiting to be sent, by when to send them.
    index("reminders_due_idx")
      .on(t.notifyAt)
      .where(sql`${t.status} = 'pending' and ${t.notifiedAt} is null`),
    uniqueIndex("reminders_user_event_uidx").on(t.userId, t.eventUid).where(sql`${t.eventUid} is not null`),
  ],
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(user, { fields: [reminders.userId], references: [user.id] }),
}));

export type Reminder = typeof reminders.$inferSelect;
