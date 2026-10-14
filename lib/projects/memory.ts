import "server-only";
import { generateText, type LanguageModel } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { MEMORY_MAX_CHARS } from "./chat-types";

const NO_CHANGE = "NO_CHANGE";

const INSTRUCTIONS = `You keep the memory for one of the user's projects. The memory is a short Markdown record of facts the user has shared, and every chat in the project reads it.

You get the current memory and the newest exchange. Reply with the full updated memory, or exactly ${NO_CHANGE} when the exchange adds nothing new (for example, the user only asked a question).

Rules:
- Keep every specific detail: names, amounts with their currency, dates, quantities, decisions, promises, who did what.
- Keep running totals and balances correct. If someone pays back or a fact changes, update it; do not just add a new line.
- When the user corrects something, replace the old fact.
- Record only what the user said or confirmed. Leave out greetings, questions, and the assistant's suggestions or guesses.
- Group facts under short headings. Use a Markdown table for money or other lists of entries.
- Stay under ${Math.round(MEMORY_MAX_CHARS / 5)} words. If it gets long, merge older details into totals, but never drop an open balance or an open task.
- Write the memory in the language the user uses.`;

/**
 * After each reply, folds anything new from that exchange into the project
 * memory. Runs in the background (after()), so the user never waits for it.
 * Input stays small: the memory plus one exchange, never the whole chat.
 *
 * Two chats can finish at the same moment, so the write only succeeds if the
 * memory has not changed since it was read; otherwise it reads again and
 * retries once.
 */
export async function updateProjectMemory({
  projectId,
  model,
  userText,
  assistantText,
}: {
  projectId: string;
  model: LanguageModel;
  userText: string;
  assistantText: string;
}): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const [current] = await db
      .select({ memory: projects.memory, version: projects.memoryVersion })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!current) return false;

    const { text } = await generateText({
      model,
      maxRetries: 1,
      instructions: INSTRUCTIONS,
      prompt:
        `<current_memory>\n${current.memory || "(empty)"}\n</current_memory>\n\n` +
        `<newest_exchange>\nUser: ${userText}\n\nAssistant: ${assistantText}\n</newest_exchange>`,
    });

    // Some models wrap Markdown in a code fence; keep only what is inside.
    const next = text
      .trim()
      .replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i, "$1")
      .trim();
    if (!next || next === NO_CHANGE || next === current.memory) return false;

    const saved = await db
      .update(projects)
      .set({
        memory: next.slice(0, MEMORY_MAX_CHARS),
        memoryVersion: sql`${projects.memoryVersion} + 1`,
        memoryUpdatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.memoryVersion, current.version)))
      .returning({ id: projects.id });
    if (saved.length) return true;
  }
  return false;
}
