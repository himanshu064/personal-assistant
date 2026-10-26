"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { createReminder, draftReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { safeAction } from "@/lib/safe-action";
import { ModalBody } from "@/components/common/responsive-modal";
import { fromLocalInputValue } from "@/lib/time";
import { showSavedReminder } from "./saved-toast";
import { ReminderForm } from "./reminder-form";
import { VoiceCapture } from "./voice-capture";

export type Preview = { draft: ReminderDraft; heard: string; source: "voice" | "text"; timezone: string };

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * "New reminder": speak (first) or type. With a clear title and a future
 * time it is saved straight away (Undo in the toast), like the mic; otherwise
 * the preview (with Repeat) asks for what is missing.
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
    if (!result.ok) {
      setDrafting(false);
      return setError(result.error);
    }
    const { draft, timezone } = result;
    const at = draft.remindAt ? fromLocalInputValue(draft.remindAt, timezone) : null;
    if (draft.title && at && at.getTime() > Date.now()) {
      const saved = await safeAction(() => createReminder({ ...draft, timezone, source }));
      if (saved.ok) {
        showSavedReminder({ id: saved.id, title: draft.title, remindAt: at.toISOString(), timezone });
        return onSaved?.();
      }
    }
    // Missing or unclear (or the save was refused): the preview shows what to fix.
    setDrafting(false);
    setPreview({ draft, heard: text, source, timezone });
  }

  // Speak or type first (scrolling body); the preview brings its own body and fixed footer.
  return preview ? (
    <ReminderPreview preview={preview} onCancel={() => setPreview(null)} onSaved={() => (setPreview(null), onSaved?.())} />
  ) : (
    <ModalBody className="justify-center">
      <VoiceCapture onText={handleText} busy={drafting} large />
      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </ModalBody>
  );
}

/** The draft as an editable form; nothing is saved until Save is tapped. */
export function ReminderPreview({ preview, onCancel, onSaved }: { preview: Preview; onCancel: () => void; onSaved: () => void }) {
  return (
    <>
      <ReminderForm
        key={preview.heard}
        intro="Check the details, fix anything that is off, then save."
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
