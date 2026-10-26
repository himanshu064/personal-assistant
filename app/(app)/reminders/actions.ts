"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { generateText } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { z } from "zod";
import { db } from "@/db";
import { aiKeys, emailItems, reminders } from "@/db/schema";
import { MODEL_CATALOG } from "@/lib/ai/models";
import { withUsage } from "@/lib/ai/usage";
import { alertSchedule } from "@/lib/reminders/schedule";
import { completeReminder } from "@/lib/reminders/complete";
import { SNOOZE_PRESETS, snoozeReminderFor } from "@/lib/reminders/snooze";
import { decrypt } from "@/lib/crypto";
import { inboxTag } from "@/lib/data/inbox-tags";
import { remindersTag } from "@/lib/data/reminders";
import { requireUser } from "@/lib/session";
import { fromLocalInputValue } from "@/lib/time";
import { reminderFormSchema } from "@/lib/validation/reminders";
import { isValidTimezone } from "@/lib/validation/settings";

type Fail = { ok: false; error: string; field?: string };

/** Slack for the time it takes to tap Save. */
const SAVE_GRACE_MS = 60_000;

/** Form values plus the timezone the preview was shown in (validated, never trusted blindly). */
const timedSchema = reminderFormSchema.extend({
  timezone: z.string().refine(isValidTimezone, "Unknown timezone."),
});

/** The reminder's time, and when its alerts go out (see lib/reminders/schedule.ts). */
function toInstants(values: z.output<typeof timedSchema>): { remindAt: Date; notifyAt: Date; alertsSent: number } | Fail {
  const remindAt = fromLocalInputValue(values.remindAt, values.timezone);
  if (!remindAt) return { ok: false, error: "Choose a date and time.", field: "remindAt" };
  return { remindAt, ...alertSchedule(remindAt, values.leadMinutes, values.alertCount) };
}

/**
 * One INSERT. From an Inbox suggestion (source "gmail"), the suggestion is
 * read first (for its invite UID) and then marked as added and linked to the
 * reminder. If that meeting already has a reminder, it is linked instead.
 */
export async function createReminder(input: unknown): Promise<{ ok: true; id: string } | Fail> {
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

  // A suggestion from a calendar invite carries its UID, so the same meeting never gets a second reminder.
  const [item] = parsed.data.emailItemId
    ? await db
        .select({ eventUid: emailItems.eventUid })
        .from(emailItems)
        .where(and(eq(emailItems.id, parsed.data.emailItemId), eq(emailItems.userId, user.id)))
        .limit(1)
    : [];
  const eventUid = item?.eventUid ?? null;

  const [inserted] = await db
    .insert(reminders)
    .values({
      userId: user.id,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      leadMinutes: parsed.data.leadMinutes,
      alertCount: parsed.data.alertCount,
      repeat: parsed.data.repeat,
      repeatAnchor: parsed.data.repeat === "none" ? null : times.remindAt,
      timezone: parsed.data.timezone,
      source: parsed.data.source,
      eventUid,
      ...times,
    })
    .onConflictDoNothing()
    .returning({ id: reminders.id });
  const created =
    inserted ??
    (
      await db
        .select({ id: reminders.id })
        .from(reminders)
        .where(and(eq(reminders.userId, user.id), eq(reminders.eventUid, eventUid!)))
        .limit(1)
    )[0];
  if (!created) return { ok: false, error: "Something went wrong. Try again." };
  updateTag(remindersTag(user.id));

  if (parsed.data.emailItemId) {
    await db
      .update(emailItems)
      .set({ status: "added", reminderId: created.id })
      .where(and(eq(emailItems.id, parsed.data.emailItemId), eq(emailItems.userId, user.id), inArray(emailItems.status, ["new", "dismissed"])));
    updateTag(inboxTag(user.id));
  }
  return { ok: true, id: created.id };
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
    : sql`(date_trunc('minute', ${reminders.remindAt}) <> ${remindAtIso}::timestamptz or ${reminders.leadMinutes} <> ${parsed.data.leadMinutes} or ${reminders.alertCount} <> ${parsed.data.alertCount} or ${reminders.repeat} <> ${parsed.data.repeat})`;
  const updated = await db
    .update(reminders)
    .set({
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      leadMinutes: parsed.data.leadMinutes,
      alertCount: parsed.data.alertCount,
      repeat: parsed.data.repeat,
      // A new time or repeat starts the series again from this date.
      repeatAnchor:
        parsed.data.repeat === "none"
          ? null
          : sql`case when ${timeChanged} or ${reminders.repeatAnchor} is null then ${remindAtIso}::timestamptz else ${reminders.repeatAnchor} end`,
      timezone: parsed.data.timezone,
      remindAt: times.remindAt,
      notifyAt: sql`case when ${timeChanged} then ${times.notifyAt.toISOString()}::timestamptz else ${reminders.notifyAt} end`,
      alertsSent: sql`case when ${timeChanged} then ${times.alertsSent} else ${reminders.alertsSent} end`,
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
export async function setReminderStatus(id: unknown, status: unknown): Promise<{ ok: true; next?: string } | Fail> {
  const user = await requireUser();
  const reminderId = idSchema.safeParse(id);
  const next = z.enum(["pending", "done", "cancelled"]).safeParse(status);
  if (!reminderId.success || !next.success) return { ok: false, error: "Something went wrong. Try again." };

  // Done on a repeating reminder moves it to its next date instead.
  if (next.data === "done") {
    const result = await completeReminder(user.id, reminderId.data);
    if (!result.found) return { ok: false, error: "This reminder no longer exists." };
    updateTag(remindersTag(user.id));
    return { ok: true, next: result.next?.toISOString() };
  }

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

/** Snooze menu: moves the reminder later and re-arms it (see lib/reminders/snooze.ts). */
export async function snoozeReminder(id: unknown, preset: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const reminderId = idSchema.safeParse(id);
  const choice = z.enum(SNOOZE_PRESETS).safeParse(preset);
  if (!reminderId.success || !choice.success) return { ok: false, error: "Something went wrong. Try again." };

  if (!(await snoozeReminderFor(user.id, reminderId.data, choice.data))) return { ok: false, error: "This reminder no longer exists." };
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
    .select({ id: aiKeys.id, encryptedKey: aiKeys.encryptedKey })
    .from(aiKeys)
    .where(and(eq(aiKeys.userId, user.id), eq(aiKeys.provider, "google"), eq(aiKeys.isActive, true)))
    .limit(1);
  if (!key) return { ok: false, error: "Voice needs Chrome or Safari, or a Gemini key in Settings. You can type instead." };

  const modelId = MODEL_CATALOG.providers.google.defaultModel;
  const model = withUsage(createGoogle({ apiKey: decrypt(key.encryptedKey) })(modelId), {
    userId: user.id,
    keyId: key.id,
    provider: "google",
    model: modelId,
    feature: "transcribe",
  });
  try {
    const { text } = await generateText({
      model,
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
