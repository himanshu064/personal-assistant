import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { account, user } from "./auth";
import { emailItemFoundByEnum, emailItemKindEnum, emailItemStatusEnum, gmailSyncStatusEnum } from "./enums";
import { reminders } from "./reminders";

/**
 * One row per connected Gmail; a user can connect several. The tokens
 * themselves stay in Better Auth's `account` table (encrypted); this row
 * tracks syncing.
 */
export const gmailSync = pgTable(
  "gmail_sync",
  {
    /** Better Auth's account row for this Google account (used to get a fresh access token). */
    accountId: uuid("account_id")
      .primaryKey()
      .references(() => account.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The Gmail address, read from Gmail on the first sync. */
    email: text("email"),
    status: gmailSyncStatusEnum("status").notNull().default("active"),
    /** Why reconnecting is needed, in plain words, when status is needs_reconnect. */
    problem: text("problem"),
    /** End of the last successful sync; the next one reads mail after this (with a small overlap). */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** Set while a sync runs, so the cron and "Sync now" never run two at once for one user. */
    syncStartedAt: timestamp("sync_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // The cron: active connections, least recently synced first.
  (t) => [
    index("gmail_sync_due_idx").on(t.lastSyncedAt).where(sql`${t.status} = 'active'`),
    index("gmail_sync_user_idx").on(t.userId),
  ],
);

/**
 * Every email the sync looked at, so none is read or sent to the AI twice.
 * Only rows with status new, added or dismissed are shown in the Inbox.
 */
export const emailItems = pgTable(
  "email_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The Gmail it was found in. Disconnecting that Gmail deletes its rows. */
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    gmailMessageId: text("gmail_message_id").notNull(),
    threadId: text("thread_id").notNull(),
    fromName: text("from_name").notNull(),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull(),
    snippet: text("snippet").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    status: emailItemStatusEnum("status").notNull().default("new"),
    // What was found (null for ignored emails).
    kind: emailItemKindEnum("kind"),
    foundBy: emailItemFoundByEnum("found_by"),
    title: text("title"),
    /** When the meeting starts or the thing is due, if the email says. */
    startsAt: timestamp("starts_at", { withTimezone: true }),
    location: text("location"),
    /** Meeting link (Meet, Zoom, Teams) when there is one. */
    link: text("link"),
    /** A calendar invite's UID. An updated or cancelled invite reuses it, so the old suggestion can be replaced. */
    eventUid: text("event_uid"),
    /** The reminder made from this suggestion. */
    reminderId: uuid("reminder_id").references(() => reminders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Never store (or classify) the same email twice.
    uniqueIndex("email_items_user_message_idx").on(t.userId, t.gmailMessageId),
    // The Inbox list: a user's suggestions by status, newest email first.
    index("email_items_user_status_received_idx").on(t.userId, t.status, t.receivedAt.desc()),
    // Finding the earlier suggestion for an updated or cancelled invite.
    index("email_items_user_event_idx").on(t.userId, t.eventUid).where(sql`${t.eventUid} is not null`),
    // Deleting a reminder clears this link; the index keeps that lookup fast.
    index("email_items_reminder_idx").on(t.reminderId).where(sql`${t.reminderId} is not null`),
    index("email_items_account_idx").on(t.accountId),
  ],
);

export const gmailSyncRelations = relations(gmailSync, ({ one }) => ({
  user: one(user, { fields: [gmailSync.userId], references: [user.id] }),
}));

export const emailItemsRelations = relations(emailItems, ({ one }) => ({
  user: one(user, { fields: [emailItems.userId], references: [user.id] }),
  reminder: one(reminders, { fields: [emailItems.reminderId], references: [reminders.id] }),
}));

export type EmailItem = typeof emailItems.$inferSelect;
