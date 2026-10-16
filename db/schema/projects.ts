import { relations, sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { chatRoleEnum } from "./enums";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /**
     * What the assistant remembers about this project (names, amounts, dates,
     * decisions), shared by all of its chats. Updated in the background after each reply.
     */
    memory: text("memory").notNull().default(""),
    /** Bumped on every memory write, so two chats updating at once never overwrite each other. */
    memoryVersion: integer("memory_version").notNull().default(0),
    memoryUpdatedAt: timestamp("memory_updated_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // The projects list: a user's projects, most recently active first.
  (t) => [index("projects_user_updated_idx").on(t.userId, t.updatedAt.desc())],
);

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The project the chat belongs to; null for a quick chat (the Chat section). Chats can move between them. */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("chat_threads_project_updated_idx").on(t.projectId, t.updatedAt.desc()),
    index("chat_threads_user_idx").on(t.userId),
    // The Chat section: a user's quick chats, most recent first.
    index("chat_threads_quick_idx").on(t.userId, t.updatedAt.desc()).where(sql`${t.projectId} is null`),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    /** The AI SDK's own message id, so a saved chat reloads exactly as it streamed. */
    id: text("id").primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: chatRoleEnum("role").notNull(),
    /** Plain text, used to rebuild the recent history sent to the model. */
    content: text("content").notNull(),
    /** The UI message parts and metadata, as the AI SDK produced them. */
    message: text("message").notNull(),
    /** Tokens and model of an answer (null on the user's messages). */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_thread_created_idx").on(t.threadId, t.createdAt)],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(user, { fields: [projects.userId], references: [user.id] }),
  threads: many(chatThreads),
}));

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  project: one(projects, { fields: [chatThreads.projectId], references: [projects.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, { fields: [chatMessages.threadId], references: [chatThreads.id] }),
}));

export type Project = typeof projects.$inferSelect;
