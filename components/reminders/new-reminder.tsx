"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { createReminder, draftReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { safeAction } from "@/lib/safe-action";
import { ReminderForm } from "./reminder-form";
import { VoiceCapture } from "./voice-capture";

type Preview = { draft: ReminderDraft; heard: string; source: "voice" | "text"; timezone: string };

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Speak (or type), check the preview, then save. Unframed, so Home and the New dialog can place it. */
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
        <>
          <p className="text-[15px] text-muted-foreground">Check the details, fix anything that is off, then save.</p>
          <ReminderForm
            key={preview.heard}
            defaultValues={{
              title: preview.draft.title,
              remindAt: preview.draft.remindAt,
              notes: preview.draft.notes,
              leadMinutes: preview.draft.leadMinutes,
            }}
            timezone={preview.timezone}
            heard={preview.heard}
            via={preview.draft.via}
            submitLabel="Save reminder"
            onCancel={() => setPreview(null)}
            onSubmit={async (values) => {
              const result = await safeAction(() => createReminder({ ...values, timezone: preview.timezone, source: preview.source }));
              if (result.ok) {
                toast.add({ title: "Reminder saved", type: "success" });
                setPreview(null);
                onSaved?.();
              }
              return result;
            }}
          />
        </>
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
