import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { aiProviderEnum } from "./enums";

/**
 * A user's own API keys, encrypted with ENCRYPTION_KEY. A user can save
 * several per provider; the one in use (is_active) powers the AI features.
 */
export const aiKeys = pgTable(
  "ai_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: aiProviderEnum("provider").notNull(),
    /** The user's name for the key, for example "Work" or "Free tier". */
    label: text("label").notNull().default(""),
    encryptedKey: text("encrypted_key").notNull(),
    last4: text("last4").notNull(),
    /** The key in use for its provider. At most one per user and provider. */
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ai_keys_user_provider_idx").on(t.userId, t.provider),
    uniqueIndex("ai_keys_user_provider_active_uidx").on(t.userId, t.provider).where(sql`${t.isActive}`),
  ],
);

/** What each AI call used: one row per model call, so keys and models can be compared. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Kept null when the key is removed, so the user's totals stay right. */
    keyId: uuid("key_id").references(() => aiKeys.id, { onDelete: "set null" }),
    provider: aiProviderEnum("provider").notNull(),
    model: text("model").notNull(),
    /** Which feature made the call: chat, reminder, assistant, gmail, transcribe. */
    feature: text("feature").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_usage_user_created_idx").on(t.userId, t.createdAt.desc()),
    // Removing a key clears this link; the index keeps that fast.
    index("ai_usage_key_idx").on(t.keyId).where(sql`${t.keyId} is not null`),
  ],
);

export const aiKeysRelations = relations(aiKeys, ({ one }) => ({
  user: one(user, { fields: [aiKeys.userId], references: [user.id] }),
}));

export type AiKey = typeof aiKeys.$inferSelect;
