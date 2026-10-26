"use server";

import { z } from "zod";
import { getDraftContext } from "@/lib/ai/user-model";
import { routeWithAi, type AssistantIntent, type AssistantRoute } from "@/lib/assistant/route-ai";
import { getMyProjectsForAssistant } from "@/lib/data/projects";
import { draftFromOutput } from "@/lib/reminders/extract-ai";
import { parseReminderWithRules } from "@/lib/reminders/parse-rules";
import { normaliseSpokenTimes } from "@/lib/reminders/spoken-text";
import { requireUser } from "@/lib/session";
import { fromLocalInputValue } from "@/lib/time";
import { createReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { isValidTimezone } from "@/lib/validation/settings";

type Fail = { ok: false; error: string };

/** A reminder saved along the way; the browser shows it with Undo. */
export type SavedReminder = { id: string; title: string; remindAt: string; timezone: string };

/** One place what the user said can go. */
export type AssistantChoice =
  | { kind: "reminder"; draft: ReminderDraft; timezone: string }
  | { kind: "project"; projectId: string; projectName: string; message: string }
  /** A new quick chat (the Chat section), starting with `message` ("" opens an empty one). */
  | { kind: "chat"; message: string };

export type AssistantResult =
  | ({ ok: true; saved?: undefined } & Extract<AssistantChoice, { kind: "reminder" }>)
  | ({ ok: true; kind: "saved" } & SavedReminder)
  /** `saved`: the user also asked for a reminder ("... and remind me to pay the plumber on Friday"). */
  | ({ ok: true; saved?: SavedReminder } & Exclude<AssistantChoice, { kind: "reminder" }>)
  /** The AI was not sure where it goes: the user picks. */
  | { ok: true; kind: "choose"; options: AssistantChoice[] }
  | Fail;

const inputSchema = z.object({
  text: z.string().trim().min(2, "Say or type something first.").max(2000, "That is too long. Try a shorter request."),
  timezone: z.string().min(1),
  /** The project page the user is on, if any: "add this" most likely means this project. */
  projectId: z.uuid().nullable(),
  source: z.enum(["voice", "text"]),
});

/** Further ahead than this, a reminder is opened in the preview instead of saved: most likely a misheard date. */
const MAX_AHEAD_MS = 400 * 24 * 60 * 60 * 1000;

/**
 * The mic button: works out what the user said and where it goes. The user
 * never says whether it is new or about something that exists, so the AI
 * decides with everything it needs: their projects (with what each one
 * remembers), the project they are looking at, and the next 14 dates.
 * - A reminder is saved straight away (the browser offers Undo); without a
 *   clear time, the preview opens to ask for one.
 * - Project news or questions go to that project's chat.
 * - Anything else opens a new quick chat.
 * - Not sure: the user picks.
 * Without an AI key (or when the AI fails), the free rules parser
 * (lib/reminders/parse-rules.ts) reads it as a reminder.
 */
export async function askAssistant(input: unknown): Promise<AssistantResult> {
  const user = await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Try again." };
  const { projectId: currentProjectId } = parsed.data;
  // Spoken times ("5 30 PM") written as normal times ("5:30 PM") before anything reads them.
  const text = normaliseSpokenTimes(parsed.data.text);

  const [context, projects] = await Promise.all([getDraftContext(user.id, "assistant"), getMyProjectsForAssistant()]);
  const timezone = context.timezone ?? (isValidTimezone(parsed.data.timezone) ? parsed.data.timezone : "UTC");

  /** The user's default alert time and count apply when the sentence did not ask for them. */
  const withDefaults = (draft: ReminderDraft): ReminderDraft => ({
    ...draft,
    leadMinutes: draft.leadMinutes || context.defaultLeadMinutes,
    alertCount: draft.alertCount || context.defaultAlertCount,
  });

  /** Saves a draft with a title and a sensible future time; null when the user should check it first. */
  const trySave = async (draft: ReminderDraft): Promise<SavedReminder | null> => {
    const at = draft.remindAt ? fromLocalInputValue(draft.remindAt, timezone) : null;
    if (!draft.title || !at || at.getTime() <= Date.now() || at.getTime() > Date.now() + MAX_AHEAD_MS) return null;
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
    return saved.ok ? { id: saved.id, title: draft.title, remindAt: at.toISOString(), timezone } : null;
  };

  const asReminder = async (draft: ReminderDraft): Promise<AssistantResult> => {
    const full = withDefaults(draft);
    const saved = await trySave(full);
    return saved ? { ok: true, kind: "saved", ...saved } : { ok: true, kind: "reminder", draft: full, timezone };
  };

  // The user waits on this, and it only sorts and reads dates: the provider's fast model does it.
  const model = context.cheapModel ?? context.model;
  // Without a key, a reminder is the only thing the app can do (chats need the AI).
  if (!model) return asReminder(parseReminderWithRules(text, timezone));

  let output: AssistantRoute;
  try {
    output = await routeWithAi(model, text, timezone, projects, currentProjectId);
  } catch (error) {
    console.warn("assistant.ai_failed", { message: error instanceof Error ? error.message : String(error) });
    // Still useful without the AI: with a time it is most likely a reminder; otherwise the chat can try again.
    const draft = parseReminderWithRules(text, timezone);
    return draft.remindAt ? asReminder(draft) : { ok: true, kind: "chat", message: text };
  }

  const toChoice = (intent: AssistantIntent, projectId: string | null): AssistantChoice | null => {
    if (intent === "reminder") {
      const draft = output.reminder ? draftFromOutput(output.reminder) : parseReminderWithRules(text, timezone);
      return { kind: "reminder", draft: withDefaults(draft), timezone };
    }
    if (intent === "project") {
      const project = projects.find((p) => p.id === projectId);
      return project ? { kind: "project", projectId: project.id, projectName: project.name, message: output.message?.trim() || text } : null;
    }
    return { kind: "chat", message: output.message?.trim() ?? text };
  };
  const first = toChoice(output.intent, output.projectId) ?? { kind: "chat", message: text };

  if (!output.sure && output.otherIntent) {
    const second = toChoice(output.otherIntent, output.otherProjectId);
    if (second && !sameChoice(first, second)) {
      // A new chat is always offered, so a wrong guess is never a dead end.
      const options = [first, second];
      if (!options.some((o) => o.kind === "chat")) options.push({ kind: "chat", message: text });
      return { ok: true, kind: "choose", options };
    }
  }

  if (first.kind === "reminder") return asReminder(first.draft);
  // "... and remind me to pay the plumber on Friday": the reminder is saved too.
  const saved = output.reminder ? await trySave(withDefaults(draftFromOutput(output.reminder))) : null;
  return { ok: true, ...first, ...(saved ? { saved } : {}) };
}

function sameChoice(a: AssistantChoice, b: AssistantChoice) {
  return a.kind === b.kind && (a.kind !== "project" || a.projectId === (b as { projectId: string }).projectId);
}
