import { pgEnum } from "drizzle-orm/pg-core";

export const aiProviderEnum = pgEnum("ai_provider", ["anthropic", "google"]);

export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "done", "cancelled"]);

/** Where a reminder came from: spoken, typed, or (Phase 3) a Gmail suggestion. */
export const reminderSourceEnum = pgEnum("reminder_source", ["voice", "text", "gmail"]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

export const gmailSyncStatusEnum = pgEnum("gmail_sync_status", ["active", "needs_reconnect"]);

/** What a suggestion from an email is about. */
export const emailItemKindEnum = pgEnum("email_item_kind", ["meeting", "reminder", "deadline"]);

/** new: waiting in the Inbox; added: a reminder was made from it; dismissed; ignored: checked, nothing to suggest. */
export const emailItemStatusEnum = pgEnum("email_item_status", ["new", "added", "dismissed", "ignored"]);

/** invite: read from a calendar invite (.ics), free; ai: found by the user's AI model. */
export const emailItemFoundByEnum = pgEnum("email_item_found_by", ["invite", "ai"]);
