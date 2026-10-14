import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { reminderSourceEnum, reminderStatusEnum } from "./enums";

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
    /** Alert this many minutes before remindAt. */
    leadMinutes: integer("lead_minutes").notNull().default(0),
    /**
     * remindAt minus leadMinutes, set on every write. Stored (not computed in
     * the query) so the cron can use an index to find due reminders.
     */
    notifyAt: timestamp("notify_at", { withTimezone: true }).notNull(),
    status: reminderStatusEnum("status").notNull().default("pending"),
    source: reminderSourceEnum("source").notNull().default("text"),
    /** Set when the cron claims the reminder; cleared on edit or snooze so it fires again. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /** True when at least one device received the push. */
    pushSent: boolean("push_sent").notNull().default(false),
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
  ],
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(user, { fields: [reminders.userId], references: [user.id] }),
}));

export type Reminder = typeof reminders.$inferSelect;
