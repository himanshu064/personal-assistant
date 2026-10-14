import { after, NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createUIMessageStreamResponse, generateId, streamText, toUIMessageStream, type ModelMessage, type ToolSet } from "ai";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, chatThreads, projects } from "@/db/schema";
import { getDraftContext } from "@/lib/ai/user-model";
import { memoryTag, messagesTag, projectsTag, threadsTag } from "@/lib/data/projects";
import {
  HISTORY_CHAR_BUDGET,
  HISTORY_MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  type ProjectChatMessage,
} from "@/lib/projects/chat-types";
import { updateProjectMemory } from "@/lib/projects/memory";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

const bodySchema = z.object({
  /**
   * The chat's id. The browser makes it for a new chat, so it always knows
   * which chat it is in; the chat row is saved with the first answer.
   */
  threadId: z.uuid(),
  /** "regenerate-message" when the user taps "Write this reply again". */
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).min(1),
  }),
});

function textOf(message: { parts: { type: string; text?: string }[] }): string {
  return message.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/**
 * Project chat, like a normal assistant chat: the user tells it things about
 * the project and asks about them. Each reply sends only the project memory
 * (facts from all of this project's chats) and this chat's recent messages,
 * so tokens stay bounded however long the project gets. After the reply, the
 * memory is updated in the background.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/projects/[projectId]/chat">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { projectId } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(projectId).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { threadId, trigger } = parsed.data;
  const question = textOf(parsed.data.message);
  if (!question) return NextResponse.json({ error: "Write or say something first." }, { status: 400 });
  if (question.length > MAX_MESSAGE_CHARS) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  // Ownership, the user's models and the chat, in parallel.
  const [[project], context, [thread]] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, description: projects.description, memory: projects.memory })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1),
    getDraftContext(userId),
    db
      .select({ projectId: chatThreads.projectId, userId: chatThreads.userId })
      .from(chatThreads)
      .where(eq(chatThreads.id, threadId))
      .limit(1),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  // An id that belongs to another project or user is refused, never reused.
  if (thread && (thread.projectId !== projectId || thread.userId !== userId)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  if (!context.model) {
    return NextResponse.json({ error: "no_key", message: "Add an AI key in Settings to use project chats." }, { status: 400 });
  }

  const userMessage = parsed.data.message as unknown as ProjectChatMessage;

  // "Try again" re-sends a saved message: drop the replies after it, so the new
  // reply replaces the old one instead of piling up.
  if (thread && trigger === "regenerate-message") {
    await db.execute(sql`
      delete from chat_messages
       where thread_id = ${threadId}
         and created_at > (select created_at from chat_messages where id = ${userMessage.id} and thread_id = ${threadId})
    `);
  }

  // Newest messages first, kept while they fit the budget, then put back in order.
  const recent = thread
    ? await db
        .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(eq(chatMessages.threadId, threadId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(HISTORY_MAX_MESSAGES)
    : [];
  const history: typeof recent = [];
  let used = question.length;
  for (const m of recent) {
    if (m.id === userMessage.id) continue; // the message being answered goes last, below
    used += m.content.length;
    if (used > HISTORY_CHAR_BUDGET) break;
    history.unshift(m);
  }

  const messages: ModelMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: "user", content: question },
  ];

  const today = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: context.timezone ?? "UTC",
  }).format(new Date());

  // Resolved with the full reply once it is saved (empty on failure); the memory update waits for it.
  let finishAnswer: (text: string) => void = () => {};
  const answered = new Promise<string>((resolve) => (finishAnswer = resolve));
  const assistantId = generateId();

  /**
   * Saves the question and the FULL reply. Runs from streamText's onEnd, which
   * gets the model's whole text even if the browser left mid answer, and
   * finishes before the browser's stream closes.
   */
  async function saveExchange(answerText: string) {
    try {
      // A new chat is saved with its first answer, so a failed first try leaves no empty chat.
      if (!thread) {
        await db
          .insert(chatThreads)
          .values({ id: threadId, projectId, userId, title: question.length > 60 ? `${question.slice(0, 57)}...` : question })
          .onConflictDoNothing();
      }
      const answer: ProjectChatMessage = { id: assistantId, role: "assistant", metadata: { threadId }, parts: [{ type: "text", text: answerText }] };
      // Explicit times so the reply always sorts after its question (one statement
      // would give both the same now()), which "Try again" also relies on.
      const at = Date.now();
      await db
        .insert(chatMessages)
        .values([
          { id: userMessage.id, threadId, role: "user", content: question, message: JSON.stringify(userMessage), createdAt: new Date(at) },
          { id: assistantId, threadId, role: "assistant", content: answerText, message: JSON.stringify(answer), createdAt: new Date(at + 1) },
        ])
        .onConflictDoNothing();
      // Touch the chat and its project in one statement, for "most recent first" lists.
      await db.execute(sql`
        with t as (update chat_threads set updated_at = now() where id = ${threadId} returning project_id)
        update projects set updated_at = now() where id in (select project_id from t)
      `);
      revalidateTag(messagesTag(threadId), { expire: 0 });
      revalidateTag(threadsTag(projectId), { expire: 0 });
      revalidateTag(projectsTag(userId), { expire: 0 });
      finishAnswer(answerText);
    } catch (error) {
      console.error("project.chat_save_failed", { message: error instanceof Error ? error.message : String(error) });
      finishAnswer("");
    }
  }

  const result = streamText({
    model: context.model,
    maxRetries: 1,
    instructions:
      `You are the user's personal assistant for their project "${project.name}"` +
      (project.description ? ` (${project.description})` : "") +
      ". The user tells you things about this project, often by voice, and asks you about them.\n" +
      "- When they share information, confirm it briefly. When it helps, show a running summary, for example a Markdown table of who gave whom how much.\n" +
      "- When they ask, answer from the project memory and this conversation. Do the arithmetic carefully and show the parts of a total.\n" +
      "- If something is unclear (for example, whether money was a loan or a gift), say what you assumed, in one line.\n" +
      "- If you do not know, say so. Never invent facts.\n" +
      "- Keep replies short. Use Markdown (bold, lists, tables) only when it makes the answer clearer.\n" +
      `Today is ${today}.\n\n` +
      "Project memory (facts from all chats in this project, kept up to date):\n" +
      `<project_memory>\n${project.memory || "(empty: nothing saved yet)"}\n</project_memory>`,
    messages,
    onEnd: async ({ text }) => {
      // Nothing to save when the reply is empty: the user sees the error and can try again.
      if (text.trim()) await saveExchange(text.trim());
      else finishAnswer("");
    },
    onError: ({ error }) => {
      console.warn("project.chat_failed", { message: error instanceof Error ? error.message : String(error) });
      finishAnswer("");
    },
  });

  // After the response: fold anything new from this exchange into the project
  // memory, with the cheap model. Registered here (inside the request) and
  // waits for the saved answer.
  const memoryModel = context.cheapModel ?? context.model;
  after(async () => {
    // If the answer never finishes (provider error), give up instead of waiting forever.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const answerText = await Promise.race([answered, new Promise<string>((r) => (timer = setTimeout(() => r(""), 55_000)))]);
    clearTimeout(timer);
    if (!answerText) return;
    try {
      if (await updateProjectMemory({ projectId, model: memoryModel, userText: question, assistantText: answerText })) {
        revalidateTag(memoryTag(projectId), { expire: 0 });
      }
    } catch (error) {
      console.warn("project.memory_update_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Keep generating (and saving) even if the browser disconnects mid answer.
  void result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<ToolSet, ProjectChatMessage>({
      stream: result.stream,
      originalMessages: [userMessage],
      // Same id as the saved reply, so a reloaded chat matches what streamed.
      generateMessageId: () => assistantId,
      messageMetadata: ({ part }) => (part.type === "start" ? { threadId } : undefined),
      onError: () => "The AI provider could not answer. Check your key in Settings, then try again.",
    }),
  });
}
