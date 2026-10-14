"use client";

import { ResponsiveModal } from "@/components/common/responsive-modal";
import { ReminderForm } from "@/components/reminders/reminder-form";
import { toast } from "@/components/ui/toast";
import { createReminder } from "@/app/(app)/reminders/actions";
import type { InboxItem } from "@/lib/data/inbox";
import { safeAction } from "@/lib/safe-action";
import { toLocalInputValue } from "@/lib/time";

/** Meetings alert 10 minutes early by default, so there is time to join. */
const MEETING_LEAD_MINUTES = 10;

/**
 * The same preview card as a spoken reminder, filled in from the email. The
 * user can change anything; nothing is saved until they tap Save.
 */
export function CreateFromSuggestion({
  open,
  onOpenChange,
  item,
  timezone,
  defaultLeadMinutes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InboxItem;
  timezone: string;
  defaultLeadMinutes: number;
  onCreated: () => void;
}) {
  const notes = [
    `From ${item.fromName}: ${item.subject}`,
    item.location ? `Where: ${item.location}` : null,
    item.link ? `Link: ${item.link}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Create reminder" description="Check the details, fix anything that is off, then save.">
      <ReminderForm
        defaultValues={{
          title: item.title,
          remindAt: item.startsAt ? toLocalInputValue(new Date(item.startsAt), timezone) : "",
          notes,
          leadMinutes: item.kind === "meeting" ? Math.max(defaultLeadMinutes, MEETING_LEAD_MINUTES) : defaultLeadMinutes,
        }}
        timezone={timezone}
        submitLabel="Save reminder"
        onCancel={() => onOpenChange(false)}
        onSubmit={async (values) => {
          const result = await safeAction(() => createReminder({ ...values, timezone, source: "gmail", emailItemId: item.id }));
          if (result.ok) {
            toast.add({ title: "Reminder saved", type: "success" });
            onOpenChange(false);
            onCreated();
          }
          return result;
        }}
      />
    </ResponsiveModal>
  );
}
