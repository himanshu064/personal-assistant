"use client";

import { toast } from "@/components/ui/toast";
import { createReminder } from "@/app/(app)/reminders/actions";
import type { ReminderDraft } from "@/lib/validation/reminders";
import { safeAction } from "@/lib/safe-action";
import { ReminderForm } from "./reminder-form";

export type Preview = { draft: ReminderDraft; heard: string; source: "voice" | "text"; timezone: string };

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
