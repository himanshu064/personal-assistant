"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { generateText } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { z } from "zod";
import { db } from "@/db";
import { aiKeys, emailItems, reminders } from "@/db/schema";
import { MODEL_CATALOG } from "@/lib/ai/models";
import { getDraftContext } from "@/lib/ai/user-model";
import { decrypt } from "@/lib/crypto";
import { inboxTag } from "@/lib/data/inbox-tags";
import { remindersTag } from "@/lib/data/reminders";
import { extractReminderWithAi } from "@/lib/reminders/extract-ai";
import { parseReminderWithRules } from "@/lib/reminders/parse-rules";
import { requireUser } from "@/lib/session";
import { fromLocalInputValue } from "@/lib/time";
import { reminderFormSchema, reminderTextSchema, type ReminderDraft } from "@/lib/validation/reminders";
import { isValidTimezone } from "@/lib/validation/settings";

type Fail = { ok: false; error: string; field?: string };

/** Slack for the time it takes to tap Save. */
const SAVE_GRACE_MS = 60_000;

/**
 * Turns spoken or typed text into a draft for the preview card. Uses the
 * user's AI model when they have a key, otherwise the free rules parser. If
 * the AI call fails, it falls back to the rules parser instead of failing.
 * Nothing is saved here. One database round trip (getDraftContext).
 */
export async function draftReminder(input: unknown): Promise<{ ok: true; draft: ReminderDraft; timezone: string } | Fail> {
  const user = await requireUser();
  const parsed = reminderTextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Try again." };

  const context = await getDraftContext(user.id);
  // The saved timezone wins; the browser's is the fallback for brand new users.
  const timezone = context.timezone ?? (isValidTimezone(parsed.data.timezone) ? parsed.data.timezone : "UTC");

  let draft: ReminderDraft | null = null;
  if (context.model) {
    try {
      draft = await extractReminderWithAi(context.model, parsed.data.text, timezone);
    } catch (error) {
      console.warn("reminders.draft.ai_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  }
  draft ??= parseReminderWithRules(parsed.data.text, timezone);
  // The user's default alert time applies when the sentence did not ask for one.
  if (draft.leadMinutes === 0) draft.leadMinutes = context.defaultLeadMinutes;
  return { ok: true, draft, timezone };
}

/** Form values plus the timezone the preview was shown in (validated, never trusted blindly). */
const timedSchema = reminderFormSchema.extend({
  timezone: z.string().refine(isValidTimezone, "Unknown timezone."),
});

function toInstants(values: z.output<typeof timedSchema>): { remindAt: Date; notifyAt: Date } | Fail {
  const remindAt = fromLocalInputValue(values.remindAt, values.timezone);
  if (!remindAt) return { ok: false, error: "Choose a date and time.", field: "remindAt" };
  return { remindAt, notifyAt: new Date(remindAt.getTime() - values.leadMinutes * 60_000) };
}

/**
 * One INSERT. From an Inbox suggestion (source "gmail"), one more UPDATE marks
 * the suggestion as added and links it to the new reminder.
 */
export async function createReminder(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = timedSchema
    .extend({ source: z.enum(["voice", "text", "gmail"]), emailItemId: z.uuid().optional() })
    .refine((v) => v.source !== "gmail" || v.emailItemId, "Missing suggestion.")
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." };

  const times = toInstants(parsed.data);
  if ("ok" in times) return times;
  if (times.remindAt.getTime() < Date.now() - SAVE_GRACE_MS) {
    return { ok: false, error: "That time has already passed. Pick a time in the future.", field: "remindAt" };
  }

  const [created] = await db
    .insert(reminders)
    .values({
      userId: user.id,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      leadMinutes: parsed.data.leadMinutes,
      timezone: parsed.data.timezone,
      source: parsed.data.source,
      ...times,
    })
    .returning({ id: reminders.id });
  updateTag(remindersTag(user.id));

  if (parsed.data.emailItemId) {
    await db
      .update(emailItems)
      .set({ status: "added", reminderId: created.id })
      .where(and(eq(emailItems.id, parsed.data.emailItemId), eq(emailItems.userId, user.id), inArray(emailItems.status, ["new", "dismissed"])));
    updateTag(inboxTag(user.id));
  }
  return { ok: true };
}

const idSchema = z.uuid();

/**
 * One round trip: a single UPDATE.
 * - Changing the time or alert re-arms the reminder (pending, not yet sent).
 * - Only the text changed: status and "sent" stay as they were, so fixing the
 *   title of a done or overdue reminder does not reopen it or send it again.
 * - A time in the past is only accepted when it is the time already saved,
 *   and then nothing is re-armed (changing only the alert of an overdue
 *   reminder must not send a late push).
 */
export async function updateReminder(id: unknown, input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const reminderId = idSchema.safeParse(id);
  const parsed = timedSchema.safeParse(input);
  if (!reminderId.success || !parsed.success) return { ok: false, error: "Check the highlighted fields." };

  const times = toInstants(parsed.data);
  if ("ok" in times) return times;
  const inPast = times.remindAt.getTime() < Date.now() - SAVE_GRACE_MS;
  const remindAtIso = times.remindAt.toISOString();

  const timeChanged = inPast
    ? sql`false`
    : sql`(date_trunc('minute', ${reminders.remindAt}) <> ${remindAtIso}::timestamptz or ${reminders.leadMinutes} <> ${parsed.data.leadMinutes})`;
  const updated = await db
    .update(reminders)
    .set({
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      leadMinutes: parsed.data.leadMinutes,
      timezone: parsed.data.timezone,
      remindAt: times.remindAt,
      notifyAt: times.notifyAt,
      status: sql`case when ${timeChanged} then 'pending'::reminder_status else ${reminders.status} end`,
      notifiedAt: sql`case when ${timeChanged} then null else ${reminders.notifiedAt} end`,
      pushSent: sql`case when ${timeChanged} then false else ${reminders.pushSent} end`,
    })
    .where(
      and(
        eq(reminders.id, reminderId.data),
        eq(reminders.userId, user.id),
        inPast ? sql`date_trunc('minute', ${reminders.remindAt}) = ${remindAtIso}::timestamptz` : undefined,
      ),
    )
    .returning({ id: reminders.id });

  if (updated.length === 0) {
    return inPast
      ? { ok: false, error: "That time has already passed. Pick a time in the future.", field: "remindAt" }
      : { ok: false, error: "This reminder no longer exists." };
  }
  updateTag(remindersTag(user.id));
  return { ok: true };
}

/**
 * Done, cancelled, or back to pending. Reopening a reminder whose time has
 * passed keeps it marked as handled, so it does not fire a late push.
 */
export async function setReminderStatus(id: unknown, status: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const reminderId = idSchema.safeParse(id);
  const next = z.enum(["pending", "done", "cancelled"]).safeParse(status);
  if (!reminderId.success || !next.success) return { ok: false, error: "Something went wrong. Try again." };

  await db
    .update(reminders)
    .set({
      status: next.data,
      ...(next.data === "pending"
        ? { notifiedAt: sql`case when ${reminders.remindAt} < now() then coalesce(${reminders.notifiedAt}, now()) else ${reminders.notifiedAt} end` }
        : {}),
    })
    .where(and(eq(reminders.id, reminderId.data), eq(reminders.userId, user.id)));
  updateTag(remindersTag(user.id));
  return { ok: true };
}

/**
 * Moves the reminder later and re-arms it, in one UPDATE. "tomorrow" is 9:00
 * tomorrow in the reminder's own timezone, worked out by Postgres. Times are
 * rounded to the minute so later edits compare cleanly.
 */
export async function snoozeReminder(id: unknown, preset: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const reminderId = idSchema.safeParse(id);
  const choice = z.enum(["10m", "1h", "tomorrow"]).safeParse(preset);
  if (!reminderId.success || !choice.success) return { ok: false, error: "Something went wrong. Try again." };

  const newTime =
    choice.data === "tomorrow"
      ? sql`((date_trunc('day', now() at time zone ${reminders.timezone}) + interval '1 day 9 hours') at time zone ${reminders.timezone})`
      : sql`date_trunc('minute', now() + ${choice.data === "10m" ? "10 minutes" : "1 hour"}::interval)`;

  // A snoozed reminder alerts at the new time itself, so the lead time is cleared.
  const updated = await db
    .update(reminders)
    .set({ remindAt: newTime, notifyAt: newTime, leadMinutes: 0, status: "pending", notifiedAt: null, pushSent: false })
    .where(and(eq(reminders.id, reminderId.data), eq(reminders.userId, user.id)))
    .returning({ id: reminders.id });
  if (updated.length === 0) return { ok: false, error: "This reminder no longer exists." };

  updateTag(remindersTag(user.id));
  return { ok: true };
}

export async function deleteReminder(id: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const reminderId = idSchema.safeParse(id);
  if (!reminderId.success) return { ok: false, error: "Something went wrong. Try again." };

  await db.delete(reminders).where(and(eq(reminders.id, reminderId.data), eq(reminders.userId, user.id)));
  updateTag(remindersTag(user.id));
  return { ok: true };
}

/** Largest recording accepted, about a minute of compressed speech. */
const MAX_AUDIO_BYTES = 900_000;

/**
 * Fallback speech to text for browsers without built in speech recognition
 * (mainly Firefox). Claude cannot take audio, so this uses the user's Google
 * key when they have one, whatever provider they picked for everything else.
 */
export async function transcribeAudio(formData: FormData): Promise<{ ok: true; text: string } | Fail> {
  const user = await requireUser();
  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return { ok: false, error: "No recording received." };
  if (audio.size > MAX_AUDIO_BYTES) return { ok: false, error: "That recording is too long. Keep it under a minute." };

  const [key] = await db
    .select({ encryptedKey: aiKeys.encryptedKey })
    .from(aiKeys)
    .where(and(eq(aiKeys.userId, user.id), eq(aiKeys.provider, "google")))
    .limit(1);
  if (!key) return { ok: false, error: "Voice needs Chrome or Safari, or a Gemini key in Settings. You can type instead." };

  const google = createGoogle({ apiKey: decrypt(key.encryptedKey) });
  try {
    const { text } = await generateText({
      model: google(MODEL_CATALOG.providers.google.defaultModel),
      maxRetries: 1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio exactly. Reply with only the words spoken, nothing else." },
            { type: "file", data: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type || "audio/webm" },
          ],
        },
      ],
    });
    return { ok: true, text: text.trim() };
  } catch (error) {
    console.warn("reminders.transcribe.failed", { message: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "We could not understand that recording. Try again or type instead." };
  }
}
