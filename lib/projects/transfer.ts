import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, chatThreads, projects } from "@/db/schema";
import { MEMORY_MAX_CHARS, type ProjectChatMessage } from "@/lib/projects/chat-types";

/**
 * Export and import of a project (with its memory and chats) or of one chat,
 * as a JSON file, so the data can move to another account. Only the user's
 * own words, the answers, the memory and token counts travel; keys, Gmail,
 * reminders and settings never do.
 */

export const EXPORT_FORMAT = "personal-assistant-export";
/** Bump when the file changes shape; import keeps reading older versions. */
export const EXPORT_VERSION = 1;
/** Largest file import accepts (Vercel refuses request bodies over 4.5 MB). */
export const MAX_IMPORT_BYTES = 4_000_000;

const usageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  model: z.string().max(100),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(100_000),
  createdAt: z.iso.datetime({ offset: true }),
  usage: usageSchema.nullable().optional(),
});

const chatSchema = z.object({
  title: z.string().trim().min(1).max(200),
  createdAt: z.iso.datetime({ offset: true }),
  messages: z.array(messageSchema).min(1).max(5_000),
});

const projectSchema = z.object({
  // Same limits as the New project form.
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable(),
  memory: z.string().max(MEMORY_MAX_CHARS),
  chats: z.array(chatSchema).max(1_000),
});

const header = { format: z.literal(EXPORT_FORMAT), version: z.literal(EXPORT_VERSION), exportedAt: z.iso.datetime({ offset: true }) };

export const exportFileSchema = z.discriminatedUnion("kind", [
  z.object({ ...header, kind: z.literal("project"), project: projectSchema }),
  z.object({ ...header, kind: z.literal("chat"), chat: chatSchema }),
]);

export type ExportFile = z.infer<typeof exportFileSchema>;
type ExportChat = z.infer<typeof chatSchema>;

// ---------------------------------------------------------------------------
// Export

/** A project the user owns, with every chat and message, oldest first. Null if it is not theirs. */
export async function exportProject(userId: string, projectId: string): Promise<ExportFile | null> {
  const [project] = await db
    .select({ name: projects.name, description: projects.description, memory: projects.memory })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return null;

  const threads = await db
    .select({ id: chatThreads.id, title: chatThreads.title, createdAt: chatThreads.createdAt })
    .from(chatThreads)
    .where(and(eq(chatThreads.projectId, projectId), eq(chatThreads.userId, userId)))
    .orderBy(asc(chatThreads.createdAt));
  const messages = await messagesByThread(threads.map((t) => t.id));

  return {
    ...fileHeader(),
    kind: "project",
    project: {
      ...project,
      // Chats that never got a message (none are saved like that, but just in case) are left out.
      chats: threads.filter((t) => messages.get(t.id)?.length).map((t) => toExportChat(t, messages.get(t.id)!)),
    },
  };
}

/** One chat the user owns (in a project or a quick chat). Null if it is not theirs or is empty. */
export async function exportChat(userId: string, threadId: string): Promise<{ file: ExportFile; title: string } | null> {
  const [thread] = await db
    .select({ id: chatThreads.id, title: chatThreads.title, createdAt: chatThreads.createdAt })
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
    .limit(1);
  if (!thread) return null;
  const rows = (await messagesByThread([thread.id])).get(thread.id);
  if (!rows?.length) return null;
  return { file: { ...fileHeader(), kind: "chat", chat: toExportChat(thread, rows) }, title: thread.title };
}

type MessageRow = { threadId: string; role: "user" | "assistant"; content: string; inputTokens: number | null; outputTokens: number | null; model: string | null; createdAt: Date };

async function messagesByThread(threadIds: string[]) {
  const byThread = new Map<string, MessageRow[]>();
  if (threadIds.length === 0) return byThread;
  const rows = await db
    .select({
      threadId: chatMessages.threadId,
      role: chatMessages.role,
      content: chatMessages.content,
      inputTokens: chatMessages.inputTokens,
      outputTokens: chatMessages.outputTokens,
      model: chatMessages.model,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(inArray(chatMessages.threadId, threadIds))
    .orderBy(asc(chatMessages.threadId), asc(chatMessages.createdAt));
  for (const row of rows) {
    const list = byThread.get(row.threadId) ?? [];
    list.push(row);
    byThread.set(row.threadId, list);
  }
  return byThread;
}

function toExportChat(thread: { title: string; createdAt: Date }, rows: MessageRow[]): ExportChat {
  return {
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    messages: rows.map((m) => ({
      role: m.role,
      text: m.content,
      createdAt: m.createdAt.toISOString(),
      usage: m.role === "assistant" && m.model ? { inputTokens: m.inputTokens ?? 0, outputTokens: m.outputTokens ?? 0, model: m.model } : null,
    })),
  };
}

function fileHeader() {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString() } as const;
}

/** A JSON file the browser saves instead of showing. Never cached: it holds the user's chats. */
export function downloadJson(data: unknown, fileName: string) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** "Billing" -> "billing-2026-10-26.json" (letters and digits only, so every browser saves it as is). */
export function exportFileName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${slug || "export"}-${new Date().toISOString().slice(0, 10)}.json`;
}

// ---------------------------------------------------------------------------
// Import

/** Where an imported file goes: a project file becomes a new project; a chat goes to the Chat section or a project. */
export type ImportTarget = { kind: "projects" } | { kind: "chat"; projectId: string | null };

export type ImportResult = { ok: true; projectId: string | null; threadId: string | null } | { ok: false; error: string };

/**
 * Adds a checked file to the user's account in ONE transaction, so a bad file
 * adds nothing. Everything gets new ids: both accounts share this database,
 * where message ids must be unique.
 */
export async function importFile(userId: string, file: ExportFile, target: ImportTarget): Promise<ImportResult> {
  if (target.kind === "projects" && file.kind !== "project") {
    return { ok: false, error: "This file is a single chat. Import it from the Chat page or a project's menu." };
  }
  if (target.kind === "chat" && file.kind !== "chat") {
    return { ok: false, error: "This file is a whole project. Import it from the Projects page." };
  }

  if (target.kind === "chat" && target.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, target.projectId), eq(projects.userId, userId), isNull(projects.archivedAt)))
      .limit(1);
    if (!project) return { ok: false, error: "That project no longer exists." };
  }

  return db.transaction(async (tx) => {
    if (file.kind === "project") {
      const name = await freeProjectName(tx, userId, file.project.name);
      const [project] = await tx
        .insert(projects)
        .values({ userId, name, description: file.project.description || null, memory: file.project.memory, memoryUpdatedAt: file.project.memory ? new Date() : null })
        .returning({ id: projects.id });
      for (const chat of file.project.chats) await insertChat(tx, userId, project.id, chat);
      return { ok: true, projectId: project.id, threadId: null };
    }
    const projectId = target.kind === "chat" ? target.projectId : null;
    const threadId = await insertChat(tx, userId, projectId, file.chat);
    return { ok: true, projectId, threadId };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** "Billing", or "Billing (imported)", "Billing (imported 2)"... when the name is taken. */
async function freeProjectName(tx: Tx, userId: string, wanted: string) {
  const taken = new Set(
    (await tx.select({ name: projects.name }).from(projects).where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))).map((p) => p.name),
  );
  if (!taken.has(wanted)) return wanted;
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? " (imported)" : ` (imported ${n})`;
    const name = `${wanted.slice(0, 80 - suffix.length)}${suffix}`;
    if (!taken.has(name)) return name;
  }
}

/** Rows per insert, well under Postgres's 65,535 parameters (8 per message). */
const INSERT_CHUNK = 1_000;

async function insertChat(tx: Tx, userId: string, projectId: string | null, chat: ExportChat): Promise<string> {
  const threadId = crypto.randomUUID();
  // Times are kept, but each message must sort after the one before it ("Try again" relies on the order).
  let previous = 0;
  const rows = chat.messages.map((m) => {
    const at = Math.max(new Date(m.createdAt).getTime(), previous + 1);
    previous = at;
    const id = crypto.randomUUID();
    const usage = m.role === "assistant" && m.usage ? m.usage : undefined;
    // The same shape the chat saves, so an imported chat reloads like any other.
    const message: ProjectChatMessage = {
      id,
      role: m.role,
      ...(usage ? { metadata: { threadId, usage } } : {}),
      parts: [{ type: "text", text: m.text }],
    };
    return {
      id,
      threadId,
      role: m.role,
      content: m.text,
      message: JSON.stringify(message),
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      model: usage?.model ?? null,
      createdAt: new Date(at),
    };
  });

  await tx.insert(chatThreads).values({
    id: threadId,
    projectId,
    userId,
    title: chat.title,
    createdAt: new Date(chat.createdAt),
    // Lists put the most recently active chat first: an imported chat sorts by its last message.
    updatedAt: new Date(previous),
  });
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) await tx.insert(chatMessages).values(rows.slice(i, i + INSERT_CHUNK));
  return threadId;
}
