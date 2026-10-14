import { pgEnum } from "drizzle-orm/pg-core";

export const aiProviderEnum = pgEnum("ai_provider", ["anthropic", "google"]);

export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "done", "cancelled"]);

/** Where a reminder came from: spoken, typed, or (Phase 3) a Gmail suggestion. */
export const reminderSourceEnum = pgEnum("reminder_source", ["voice", "text", "gmail"]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);
