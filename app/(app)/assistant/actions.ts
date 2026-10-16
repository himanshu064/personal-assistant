"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { getDraftContext } from "@/lib/ai/user-model";
import { chatMessageOf, detectIntent } from "@/lib/assistant/detect-intent";
import { getMyProjects } from "@/lib/data/projects";
import { draftFromOutput, draftSchema, extractReminderWithAi } from "@/lib/reminders/extract-ai";
import { parseReminderWithRules } from "@/lib/reminders/parse-rules";
import { requireUser } from "@/lib/session";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/time";
import { createReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { isValidTimezone } from "@/lib/validation/settings";

type Fail = { ok: false; error: string };

export type AssistantResult =
  | { ok: true; kind: "reminder"; draft: ReminderDraft; timezone: string }
  | { ok: true; kind: "saved"; id: string; title: string; remindAt: string; timezone: string }
  | { ok: true; kind: "project"; projectId: string; projectName: string; message: string }
  /** A new quick chat (the Chat section), starting with `message` ("" opens an empty one). */
  | { ok: true; kind: "chat"; message: string }
  | Fail;

const inputSchema = z.object({
  text: z.string().trim().min(2, "Say or type something first.").max(2000, "That is too long. Try a shorter request."),
  timezone: z.string().min(1),
  /** The project page the user is on, if any: "add this" most likely means this project. */
  projectId: z.uuid().nullable(),
  source: z.enum(["voice", "text"]),
});

const outputSchema = z.object({
  intent: z
    .enum(["reminder", "project", "chat"])
    .describe(
      "reminder: remember or do something at a time (a call, meeting, message, task). project: news about, or a question on, one of the listed projects. chat: anything else (questions, writing, ideas, talk).",
    ),
  reminder: draftSchema.nullable().describe("Only when intent is reminder."),
  projectId: z.string().nullable().describe("Only when intent is project: the id of one listed project."),
  projectMessage: z.string().nullable().describe("Only when intent is project: what to tell or ask that project, in the user's words."),
});

/**
 * The mic button: works out what the user said and where it goes.
 * - A reminder is saved straight away (the browser offers Undo); without a
 *   time, the preview opens to ask for one.
 * - Project news or questions go to that project's chat.
 * - Anything else ("start a chat ...", questions, writing) opens a new quick chat.
 * The words are read first without the AI (lib/assistant/detect-intent.ts);
 * the AI decides only when that is unsure, or between a chat and the project
 * the user is looking at.
 */
export async function askAssistant(input: unknown): Promise<AssistantResult> {
  const user = await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Try again." };
  const { text, projectId: currentProjectId } = parsed.data;

  const [context, projects] = await Promise.all([getDraftContext(user.id, "assistant"), getMyProjects()]);
  const timezone = context.timezone ?? (isValidTimezone(parsed.data.timezone) ? parsed.data.timezone : "UTC");
  const current = projects.find((p) => p.id === currentProjectId);

  const asReminder = async (draft: ReminderDraft): Promise<AssistantResult> => {
    // The user's default alert time and count apply when the sentence did not ask for them.
    if (draft.leadMinutes === 0) draft.leadMinutes = context.defaultLeadMinutes;
    if (draft.alertCount === 0) draft.alertCount = context.defaultAlertCount;
    const at = draft.remindAt ? fromLocalInputValue(draft.remindAt, timezone) : null;
    if (draft.title && at && at.getTime() > Date.now()) {
      const saved = await createReminder({
        title: draft.title,
        remindAt: draft.remindAt,
        notes: draft.notes,
        leadMinutes: draft.leadMinutes,
        alertCount: draft.alertCount,
        repeat: draft.repeat,
        timezone,
        source: parsed.data.source,
      });
      if (saved.ok) return { ok: true, kind: "saved", id: saved.id, title: draft.title, remindAt: at.toISOString(), timezone };
    }
    return { ok: true, kind: "reminder", draft, timezone };
  };

  /** A reminder from the user's own model (one call), or the free rules parser. */
  const reminderFromText = async (): Promise<AssistantResult> => {
    if (context.model) {
      try {
        return await asReminder(await extractReminderWithAi(context.model, text, timezone));
      } catch (error) {
        console.warn("assistant.reminder_ai_failed", { message: error instanceof Error ? error.message : String(error) });
      }
    }
    return asReminder(parseReminderWithRules(text, timezone));
  };

  const intent = detectIntent(text, timezone);
  const explicitChat = intent === "chat" && chatMessageOf(text) !== text.trim();
  if (intent === "reminder") return reminderFromText();
  // A question while looking at a project may be about it: the AI decides between the two.
  if (explicitChat || (intent === "chat" && !current)) return { ok: true, kind: "chat", message: chatMessageOf(text) };
  // Unsure: without a key most spoken requests are reminders; with one, the AI decides.
  if (!context.model) return intent === "chat" ? { ok: true, kind: "chat", message: text } : reminderFromText();

  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now);
  let output: z.infer<typeof outputSchema>;
  try {
    ({ output } = await generateText({
      model: context.model,
      output: Output.object({ schema: outputSchema }),
      maxRetries: 1,
      system:
        "You are the user's personal assistant in an app for reminders, projects and chats. Decide what they want:\n" +
        "- reminder: remember or do something at a time: a call, meeting, message, payment, walking the dog, any task " +
        "('set a meet with Ravi tomorrow 5pm' is a reminder titled 'Meet with Ravi'). Resolve relative dates against the current local time; " +
        "if only a day is given, use 09:00.\n" +
        "- project: they share news about one of their projects (money given, decisions, notes) or ask about it. " +
        "Use the current project when the request fits it and names no other.\n" +
        "- chat: anything else: questions, advice, writing, ideas, conversation.\n" +
        "Fill only the fields for the chosen intent; set the others to null. Never invent facts.",
      prompt:
        `Current local time: ${weekday}, ${toLocalInputValue(now, timezone)} (${timezone}).\n` +
        `Current project: ${current ? `${current.name} (id ${current.id})` : "none"}\n` +
        `Projects:\n${projects.map((p) => `- ${p.name} (id ${p.id})`).join("\n") || "(none)"}\n` +
        `User said: """${text}"""`,
    }));
  } catch (error) {
    console.warn("assistant.ai_failed", { message: error instanceof Error ? error.message : String(error) });
    // Still useful without the AI: a question goes to a chat, the rest is most likely a reminder.
    return intent === "chat" ? { ok: true, kind: "chat", message: text } : reminderFromText();
  }

  if (output.intent === "project") {
    const project = projects.find((p) => p.id === output.projectId);
    if (project) return { ok: true, kind: "project", projectId: project.id, projectName: project.name, message: output.projectMessage?.trim() || text };
  }
  if (output.intent === "reminder") return asReminder(output.reminder ? draftFromOutput(output.reminder) : parseReminderWithRules(text, timezone));
  return { ok: true, kind: "chat", message: text };
}
