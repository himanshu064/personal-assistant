"use server";

import { after } from "next/server";
import { revalidateTag, updateTag } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, chatThreads, projects } from "@/db/schema";
import { getDraftContext } from "@/lib/ai/user-model";
import { chatListTags } from "@/lib/chat/reply";
import { memoryTag, messagesTag, projectsTag } from "@/lib/data/projects";
import { HISTORY_CHAR_BUDGET } from "@/lib/projects/chat-types";
import { updateProjectMemory } from "@/lib/projects/memory";
import { requireUser } from "@/lib/session";
import { memorySchema, projectSchema } from "@/lib/validation/projects";

type Fail = { ok: false; error: string; field?: string };
const idSchema = z.uuid();

export async function createProject(input: unknown): Promise<{ ok: true; id: string } | Fail> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the name.", field: "name" };

  const [row] = await db
    .insert(projects)
    .values({ userId: user.id, name: parsed.data.name, description: parsed.data.description || null })
    .returning({ id: projects.id });
  updateTag(projectsTag(user.id));
  return { ok: true, id: row.id };
}

export async function updateProject(id: unknown, input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const projectId = idSchema.safeParse(id);
  const parsed = projectSchema.safeParse(input);
  if (!projectId.success || !parsed.success) return { ok: false, error: "Check the name.", field: "name" };

  await db
    .update(projects)
    .set({ name: parsed.data.name, description: parsed.data.description || null })
    .where(and(eq(projects.id, projectId.data), eq(projects.userId, user.id)));
  updateTag(projectsTag(user.id));
  return { ok: true };
}

/** Deletes the project with its chats and memory (foreign keys cascade). */
export async function deleteProject(id: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const projectId = idSchema.safeParse(id);
  if (!projectId.success) return { ok: false, error: "Something went wrong. Try again." };

  await db.delete(projects).where(and(eq(projects.id, projectId.data), eq(projects.userId, user.id)));
  updateTag(projectsTag(user.id));
  return { ok: true };
}

/** Saves the user's own edit of the project memory (an empty memory clears it). */
export async function saveMemory(projectId: unknown, input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const pid = idSchema.safeParse(projectId);
  const parsed = memorySchema.safeParse(input);
  if (!pid.success || !parsed.success) {
    return { ok: false, error: parsed.success ? "Something went wrong. Try again." : (parsed.error.issues[0]?.message ?? "Check the memory."), field: "memory" };
  }

  // Bumping the version makes any background update that read the old memory retry on top of this edit.
  const [row] = await db
    .update(projects)
    .set({ memory: parsed.data.memory, memoryVersion: sql`${projects.memoryVersion} + 1`, memoryUpdatedAt: new Date() })
    .where(and(eq(projects.id, pid.data), eq(projects.userId, user.id)))
    .returning({ id: projects.id });
  if (!row) return { ok: false, error: "This project no longer exists." };
  updateTag(memoryTag(pid.data));
  return { ok: true };
}

export async function deleteThread(threadId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const tid = idSchema.safeParse(threadId);
  if (!tid.success) return { ok: false, error: "Something went wrong. Try again." };

  const [thread] = await db
    .delete(chatThreads)
    .where(and(eq(chatThreads.id, tid.data), eq(chatThreads.userId, user.id)))
    .returning({ projectId: chatThreads.projectId });
  // Its list (a project's chats and the chat count, or the Chat section).
  if (thread) for (const tag of chatListTags(user.id, thread.projectId)) updateTag(tag);
  return { ok: true };
}

/**
 * Moves a chat into a project, to another project, or out to the Chat section
 * (projectId null). Moving into a project also folds what the chat said into
 * that project's memory (in the background, with the cheap model), so the
 * project's other chats know it too.
 */
export async function moveThread(threadId: unknown, projectId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const tid = idSchema.safeParse(threadId);
  const target = idSchema.nullable().safeParse(projectId);
  if (!tid.success || !target.success) return { ok: false, error: "Something went wrong. Try again." };
  const to = target.data;

  const [[thread], [project]] = await Promise.all([
    db
      .select({ projectId: chatThreads.projectId })
      .from(chatThreads)
      .where(and(eq(chatThreads.id, tid.data), eq(chatThreads.userId, user.id)))
      .limit(1),
    to
      ? db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, to), eq(projects.userId, user.id), isNull(projects.archivedAt)))
          .limit(1)
      : Promise.resolve([{ id: null }]),
  ]);
  if (!thread) return { ok: false, error: "This chat no longer exists." };
  if (!project) return { ok: false, error: "That project no longer exists." };
  if (thread.projectId === to) return { ok: true };

  await db.update(chatThreads).set({ projectId: to }).where(eq(chatThreads.id, tid.data));
  for (const tag of [messagesTag(tid.data), ...chatListTags(user.id, thread.projectId), ...chatListTags(user.id, to)]) updateTag(tag);

  if (to) {
    const projectId = to;
    after(async () => {
      try {
        const [context, rows] = await Promise.all([
          getDraftContext(user.id, "chat"),
          db
            .select({ role: chatMessages.role, content: chatMessages.content })
            .from(chatMessages)
            .where(eq(chatMessages.threadId, tid.data))
            .orderBy(asc(chatMessages.createdAt)),
        ]);
        const model = context.cheapModel ?? context.model;
        if (!model || rows.length === 0) return;
        // The newest part of the chat, within the same budget a reply uses.
        const transcript = rows
          .map((r) => `${r.role === "user" ? "User" : "Assistant"}: ${r.content}`)
          .join("\n\n")
          .slice(-HISTORY_CHAR_BUDGET);
        if (await updateProjectMemory({ projectId, model, userText: `(A chat moved into this project)\n${transcript}`, assistantText: "(no reply)" })) {
          revalidateTag(memoryTag(projectId), { expire: 0 });
        }
      } catch (error) {
        console.warn("chat.move_memory_failed", { message: error instanceof Error ? error.message : String(error) });
      }
    });
  }
  return { ok: true };
}
