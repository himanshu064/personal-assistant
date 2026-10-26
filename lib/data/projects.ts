import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chatThreads, projects } from "@/db/schema";
import { requireUser } from "@/lib/session";

export const projectsTag = (userId: string) => `user:${userId}:projects`;
export const memoryTag = (projectId: string) => `project:${projectId}:memory`;
export const threadsTag = (projectId: string) => `project:${projectId}:threads`;
export const messagesTag = (threadId: string) => `thread:${threadId}:messages`;

export type ProjectCard = {
  id: string;
  name: string;
  description: string | null;
  chatCount: number;
  updatedAt: Date;
};

/** Projects list with chat counts, in one query (grouped join, no N+1). */
export async function getMyProjects(): Promise<ProjectCard[]> {
  const user = await requireUser();
  return listProjects(user.id);
}

async function listProjects(userId: string): Promise<ProjectCard[]> {
  "use cache";
  cacheTag(projectsTag(userId));
  cacheLife("minutes");

  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      chatCount: sql<number>`count(${chatThreads.id})`.mapWith(Number),
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(chatThreads, eq(chatThreads.projectId, projects.id))
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt));
}

/** How much of each project's memory the assistant reads to decide where a message goes. */
const ASSISTANT_MEMORY_CHARS = 300;

/**
 * The 30 most recently active projects, with the start of their memory, so
 * the assistant can match "the contractor" to "Kitchen renovation". Not
 * cached: the memory changes after every project reply.
 */
export async function getMyProjectsForAssistant() {
  const user = await requireUser();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      memory: sql<string>`left(regexp_replace(${projects.memory}, '\\s+', ' ', 'g'), ${ASSISTANT_MEMORY_CHARS})`,
    })
    .from(projects)
    .where(and(eq(projects.userId, user.id), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt))
    .limit(30);
}

/** One project the signed in user owns, or the 404 page. */
export async function getMyProject(projectId: string) {
  const user = await requireUser();
  const project = await findProject(user.id, projectId);
  if (!project) notFound();
  return project;
}

async function findProject(userId: string, projectId: string) {
  "use cache";
  cacheTag(projectsTag(userId));
  cacheLife("minutes");

  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [row] = await db
    .select({ id: projects.id, name: projects.name, description: projects.description, createdAt: projects.createdAt })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.archivedAt)))
    .limit(1);
  return row ?? null;
}

/** What the assistant remembers about the project, for the Memory tab. */
export async function getProjectMemory(projectId: string) {
  await getMyProject(projectId); // ownership check
  return readMemory(projectId);
}

async function readMemory(projectId: string) {
  "use cache";
  cacheTag(memoryTag(projectId));
  cacheLife("minutes");

  const [row] = await db
    .select({ memory: projects.memory, updatedAt: projects.memoryUpdatedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return { memory: row?.memory ?? "", updatedAt: row?.updatedAt ?? null };
}

export type ThreadRow = { id: string; title: string; updatedAt: Date };

export async function getProjectThreads(projectId: string): Promise<ThreadRow[]> {
  await getMyProject(projectId);
  return listThreads(projectId);
}

async function listThreads(projectId: string): Promise<ThreadRow[]> {
  "use cache";
  cacheTag(threadsTag(projectId));
  cacheLife("minutes");

  return db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(eq(chatThreads.projectId, projectId))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(50);
}

/** The newest 200 saved messages of one chat, shown oldest first, as the AI SDK UI messages they were stored as. */
export async function getThreadMessages(projectId: string, threadId: string): Promise<unknown[]> {
  await getMyProject(projectId);
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) return [];
  return listMessages(projectId, threadId);
}

async function listMessages(projectId: string, threadId: string): Promise<unknown[]> {
  "use cache";
  cacheTag(messagesTag(threadId));
  cacheLife("minutes");

  const rows = await db
    .select({ message: chatMessages.message })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
    .where(and(eq(chatMessages.threadId, threadId), eq(chatThreads.projectId, projectId)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(200);
  return rows.reverse().map((r) => JSON.parse(r.message));
}
