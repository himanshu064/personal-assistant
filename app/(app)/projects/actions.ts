"use server";

import { updateTag } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatThreads, projects } from "@/db/schema";
import { memoryTag, projectsTag, threadsTag } from "@/lib/data/projects";
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
  if (thread) {
    updateTag(threadsTag(thread.projectId));
    updateTag(projectsTag(user.id)); // chat count on the projects list
  }
  return { ok: true };
}
