import "server-only";
import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createUIMessageStreamResponse, generateId, streamText, toUIMessageStream, type LanguageModelUsage, type ModelMessage, type ToolSet } from "ai";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { getDraftContext, type DraftContext } from "@/lib/ai/user-model";
import { quickChatsTag } from "@/lib/data/chats";
import { messagesTag, projectsTag, threadsTag } from "@/lib/data/projects";
import { HISTORY_CHAR_BUDGET, HISTORY_MAX_MESSAGES, MAX_MESSAGE_CHARS, type ProjectChatMessage } from "@/lib/projects/chat-types";

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

/** The chat's tags to refresh after a reply: its messages, and the list it shows in. */
export function chatListTags(userId: string, projectId: string | null) {
  return projectId ? [threadsTag(projectId), projectsTag(userId)] : [quickChatsTag(userId)];
}

/**
 * One chat reply, shared by project chats and quick chats (projectId null).
 * Each reply sends only the instructions (with the project memory, for a
 * project) and this chat's recent messages, so tokens stay bounded however
 * long a chat gets. The question and the full answer are saved, and
 * `afterAnswer` runs in the background (project memory).
 */
export async function replyInChat({
  userId,
  projectId,
  body,
  instructions,
  afterAnswer,
}: {
  userId: string;
  projectId: string | null;
  body: unknown;
  instructions: (context: DraftContext) => string;
  afterAnswer?: (exchange: { question: string; answer: string; context: DraftContext }) => Promise<void>;
}) {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { threadId, trigger } = parsed.data;
  const question = textOf(parsed.data.message);
  if (!question) return NextResponse.json({ error: "Write or say something first." }, { status: 400 });
  if (question.length > MAX_MESSAGE_CHARS) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  const [context, [thread]] = await Promise.all([
    getDraftContext(userId, "chat"),
    db.select({ projectId: chatThreads.projectId, userId: chatThreads.userId }).from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1),
  ]);
  // An id that belongs to another user, or to a different place (another project, or
  // a project when this is a quick chat), is refused, never reused.
  if (thread && (thread.userId !== userId || thread.projectId !== projectId)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  if (!context.model) {
    return NextResponse.json({ error: "no_key", message: "Add an AI key in Settings to use chats." }, { status: 400 });
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

  // Resolved with the full reply once it is saved (empty on failure); the work after the reply waits for it.
  let finishAnswer: (text: string) => void = () => {};
  const answered = new Promise<string>((resolve) => (finishAnswer = resolve));
  const assistantId = generateId();
  const usageOf = (u: LanguageModelUsage) => ({ inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, model: context.modelId });

  /**
   * Saves the question and the FULL reply. Runs from streamText's onEnd, which
   * gets the model's whole text even if the browser left mid answer, and
   * finishes before the browser's stream closes.
   */
  async function saveExchange(answerText: string, usage: NonNullable<ProjectChatMessage["metadata"]>["usage"]) {
    try {
      // A new chat is saved with its first answer, so a failed first try leaves no empty chat.
      if (!thread) {
        await db
          .insert(chatThreads)
          .values({ id: threadId, projectId, userId, title: question.length > 60 ? `${question.slice(0, 57)}...` : question })
          .onConflictDoNothing();
      }
      const answer: ProjectChatMessage = { id: assistantId, role: "assistant", metadata: { threadId, usage }, parts: [{ type: "text", text: answerText }] };
      // Explicit times so the reply always sorts after its question (one statement
      // would give both the same now()), which "Try again" also relies on.
      const at = Date.now();
      await db
        .insert(chatMessages)
        .values([
          { id: userMessage.id, threadId, role: "user", content: question, message: JSON.stringify(userMessage), createdAt: new Date(at) },
          {
            id: assistantId,
            threadId,
            role: "assistant",
            content: answerText,
            message: JSON.stringify(answer),
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            model: usage?.model,
            createdAt: new Date(at + 1),
          },
        ])
        .onConflictDoNothing();
      // Touch the chat (and its project) for "most recent first" lists.
      await db.execute(sql`
        with t as (update chat_threads set updated_at = now() where id = ${threadId} returning project_id)
        update projects set updated_at = now() where id in (select project_id from t)
      `);
      finishAnswer(answerText);
    } catch (error) {
      console.error("chat.save_failed", { message: error instanceof Error ? error.message : String(error) });
      finishAnswer("");
    }
  }

  const result = streamText({
    model: context.model,
    maxRetries: 1,
    instructions: instructions(context),
    messages,
    onEnd: async ({ text, totalUsage }) => {
      // Nothing to save when the reply is empty: the user sees the error and can try again.
      if (text.trim()) await saveExchange(text.trim(), usageOf(totalUsage));
      else finishAnswer("");
    },
    onError: ({ error }) => {
      console.warn("chat.failed", { message: error instanceof Error ? error.message : String(error) });
      finishAnswer("");
    },
  });

  // After the response (registered inside the request): refresh the lists, then the extra work.
  after(async () => {
    // If the answer never finishes (provider error), give up instead of waiting forever.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const answerText = await Promise.race([answered, new Promise<string>((r) => (timer = setTimeout(() => r(""), 55_000)))]);
    clearTimeout(timer);
    if (!answerText) return;
    // Refreshed here, not in onEnd: onEnd runs after the request's work is
    // done, where revalidateTag is ignored and the new chat never listed.
    for (const tag of [messagesTag(threadId), ...chatListTags(userId, projectId)]) revalidateTag(tag, { expire: 0 });
    try {
      await afterAnswer?.({ question, answer: answerText, context });
    } catch (error) {
      console.warn("chat.after_answer_failed", { message: error instanceof Error ? error.message : String(error) });
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
      messageMetadata: ({ part }) =>
        part.type === "start" ? { threadId } : part.type === "finish" ? { threadId, usage: usageOf(part.totalUsage) } : undefined,
      onError: () => "The AI provider could not answer. Check your key in Settings, then try again.",
    }),
  });
}
