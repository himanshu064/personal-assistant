"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { createReminder, draftReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { safeAction } from "@/lib/safe-action";
import { ReminderForm } from "./reminder-form";
import { VoiceCapture } from "./voice-capture";

export type Preview = { draft: ReminderDraft; heard: string; source: "voice" | "text"; timezone: string };

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * "New reminder": speak (first) or type, then check the preview (with Repeat)
 * and save. The floating mic is the shortcut that saves straight away.
 * Unframed, so the New dialog can place it.
 */
export function NewReminder({ onSaved }: { onSaved?: () => void }) {
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function handleText(text: string, source: "voice" | "text") {
    setDrafting(true);
    setError(null);
    const result = await safeAction(() => draftReminder({ text, timezone: browserTimezone() }));
    setDrafting(false);
    if (!result.ok) return setError(result.error);
    setPreview({ draft: result.draft, heard: text, source, timezone: result.timezone });
  }

  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <ReminderPreview preview={preview} onCancel={() => setPreview(null)} onSaved={() => (setPreview(null), onSaved?.())} />
      ) : (
        <>
          <VoiceCapture onText={handleText} busy={drafting} />
          {error ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The draft as an editable form; nothing is saved until Save is tapped. */
export function ReminderPreview({ preview, onCancel, onSaved }: { preview: Preview; onCancel: () => void; onSaved: () => void }) {
  return (
    <>
      <p className="text-[15px] text-muted-foreground">Check the details, fix anything that is off, then save.</p>
      <ReminderForm
        key={preview.heard}
        defaultValues={{
          title: preview.draft.title,
          remindAt: preview.draft.remindAt,
          notes: preview.draft.notes,
          leadMinutes: preview.draft.leadMinutes,
          alertCount: preview.draft.alertCount,
          repeat: preview.draft.repeat,
        }}
        timezone={preview.timezone}
        heard={preview.heard}
        via={preview.draft.via}
        submitLabel="Save reminder"
        onCancel={onCancel}
        onSubmit={async (values) => {
          const result = await safeAction(() => createReminder({ ...values, timezone: preview.timezone, source: preview.source }));
          if (result.ok) {
            toast.add({ title: "Reminder saved", type: "success" });
            onSaved();
          }
          return result;
        }}
      />
    </>
  );
}
