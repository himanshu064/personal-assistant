import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { aiProviderEnum } from "./enums";

/** A user's own API key per provider, encrypted with ENCRYPTION_KEY. */
export const aiKeys = pgTable(
  "ai_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: aiProviderEnum("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    last4: text("last4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Also serves as the userId index: Postgres can use its leading column.
  (t) => [uniqueIndex("ai_keys_user_provider_uidx").on(t.userId, t.provider)],
);

export const aiKeysRelations = relations(aiKeys, ({ one }) => ({
  user: one(user, { fields: [aiKeys.userId], references: [user.id] }),
}));

export type AiKey = typeof aiKeys.$inferSelect;
