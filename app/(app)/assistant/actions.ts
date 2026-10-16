"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { getDraftContext } from "@/lib/ai/user-model";
import { getMyProjects } from "@/lib/data/projects";
import { getMyUpcomingReminders } from "@/lib/data/reminders";
import { draftFromOutput, draftSchema } from "@/lib/reminders/extract-ai";
import { parseReminderWithRules } from "@/lib/reminders/parse-rules";
import { requireUser } from "@/lib/session";
import { formatReminderTime, fromLocalInputValue, toLocalInputValue } from "@/lib/time";
import { createReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { isValidTimezone } from "@/lib/validation/settings";

type Fail = { ok: false; error: string };

export type AssistantResult =
  | { ok: true; kind: "reminder"; draft: ReminderDraft; timezone: string }
  | { ok: true; kind: "saved"; id: string; title: string; remindAt: string; timezone: string }
  | { ok: true; kind: "project"; projectId: string; projectName: string; message: string }
  | { ok: true; kind: "answer"; text: string }
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
    .enum(["reminder", "project", "answer"])
    .describe("reminder: remember or schedule something. project: news about or a question on one of the listed projects. answer: anything else."),
  reminder: draftSchema.nullable().describe("Only when intent is reminder."),
  projectId: z.string().nullable().describe("Only when intent is project: the id of one listed project."),
  projectMessage: z.string().nullable().describe("Only when intent is project: what to tell or ask that project, in the user's words."),
  answer: z.string().nullable().describe("Only when intent is answer: a short reply. Simple Markdown is fine."),
});

/**
 * The one assistant button: works out what the user said and where it goes.
 * A reminder comes back as a draft for the usual preview (never saved here),
 * project news or questions go to that project's chat, anything else is
 * answered. One AI call; without a key everything is a reminder (rules parser).
 */
export async function askAssistant(input: unknown): Promise<AssistantResult> {
  const user = await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Try again." };
  const { text, projectId: currentProjectId } = parsed.data;

  const [context, projects, upcoming] = await Promise.all([
    getDraftContext(user.id, "assistant"),
    getMyProjects(),
    getMyUpcomingReminders(15),
  ]);
  const timezone = context.timezone ?? (isValidTimezone(parsed.data.timezone) ? parsed.data.timezone : "UTC");
  /**
   * The mic button is the shortcut: a reminder with a title and a future time
   * is saved straight away (the browser offers Undo). Without a time it cannot
   * be saved, so the preview opens to ask for one.
   */
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

  if (!context.model) return asReminder(parseReminderWithRules(text, timezone));

  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now);
  const current = projects.find((p) => p.id === currentProjectId);

  let output: z.infer<typeof outputSchema>;
  try {
    ({ output } = await generateText({
      model: context.model,
      output: Output.object({ schema: outputSchema }),
      maxRetries: 1,
      system:
        "You are the user's personal assistant in an app for reminders and projects. Decide what they want:\n" +
        "- reminder: they want to remember or schedule something at a time, including meetings and calls " +
        "('set a meet with Ravi tomorrow 5pm' is a reminder titled 'Meet with Ravi'). Resolve relative dates against the current local time; " +
        "if only a day is given, use 09:00.\n" +
        "- project: they share news about one of their projects (money given, decisions, notes) or ask about it. " +
        "Use the current project when the request fits it and names no other.\n" +
        "- answer: anything else, including questions about their schedule (use the upcoming reminders below). Keep it short.\n" +
        "Fill only the fields for the chosen intent; set the others to null. Never invent facts.",
      prompt:
        `Current local time: ${weekday}, ${toLocalInputValue(now, timezone)} (${timezone}).\n` +
        `Current project: ${current ? `${current.name} (id ${current.id})` : "none"}\n` +
        `Projects:\n${projects.map((p) => `- ${p.name} (id ${p.id})`).join("\n") || "(none)"}\n` +
        `Upcoming reminders:\n${upcoming.map((r) => `- ${r.title}: ${formatReminderTime(new Date(r.remindAt), timezone)}`).join("\n") || "(none)"}\n` +
        `User said: """${text}"""`,
    }));
  } catch (error) {
    console.warn("assistant.ai_failed", { message: error instanceof Error ? error.message : String(error) });
    // Still useful without the AI: most requests are reminders.
    return asReminder(parseReminderWithRules(text, timezone));
  }

  if (output.intent === "project") {
    const project = projects.find((p) => p.id === output.projectId);
    if (project) return { ok: true, kind: "project", projectId: project.id, projectName: project.name, message: output.projectMessage?.trim() || text };
  }
  if (output.intent === "answer" && output.answer?.trim()) return { ok: true, kind: "answer", text: output.answer.trim() };
  return asReminder(output.reminder ? draftFromOutput(output.reminder) : parseReminderWithRules(text, timezone));
}
