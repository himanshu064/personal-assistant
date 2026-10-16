import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { messagesTag, type ThreadRow } from "./projects";

/** The Chat section's list (quick chats: chats with no project). */
export const quickChatsTag = (userId: string) => `user:${userId}:quick-chats`;

export async function getMyQuickThreads(): Promise<ThreadRow[]> {
  const user = await requireUser();
  return listQuickThreads(user.id);
}

async function listQuickThreads(userId: string): Promise<ThreadRow[]> {
  "use cache";
  cacheTag(quickChatsTag(userId));
  cacheLife("minutes");

  return db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, userId), isNull(chatThreads.projectId)))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(50);
}

/** One quick chat's newest 200 messages, oldest first; nothing for another user's chat or a project chat. */
export async function getQuickThreadMessages(threadId: string): Promise<unknown[]> {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) return [];
  return listQuickMessages(user.id, threadId);
}

async function listQuickMessages(userId: string, threadId: string): Promise<unknown[]> {
  "use cache";
  cacheTag(messagesTag(threadId));
  cacheLife("minutes");

  const rows = await db
    .select({ message: chatMessages.message })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
    .where(and(eq(chatMessages.threadId, threadId), eq(chatThreads.userId, userId), isNull(chatThreads.projectId)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(200);
  return rows.reverse().map((r) => JSON.parse(r.message));
}
