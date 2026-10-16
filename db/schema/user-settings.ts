import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { aiProviderEnum } from "./enums";

/** One row per user. Missing row means "use the defaults from .env". */
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone"),
  provider: aiProviderEnum("provider"),
  model: text("model"),
  /** Alert this many minutes before, for every new reminder (typed, spoken or from a meeting invite) unless it says otherwise. */
  defaultLeadMinutes: integer("default_lead_minutes").notNull().default(15),
  /** How many alerts new reminders get, 15 minutes apart (1 to 5). */
  defaultAlertCount: integer("default_alert_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, { fields: [userSettings.userId], references: [user.id] }),
}));

export type UserSettings = typeof userSettings.$inferSelect;
