"use client";

import { ResponsiveModal } from "@/components/common/responsive-modal";
import { ReminderForm } from "@/components/reminders/reminder-form";
import { toast } from "@/components/ui/toast";
import { createReminder } from "@/app/(app)/reminders/actions";
import type { InboxItem } from "@/lib/data/inbox";
import { safeAction } from "@/lib/safe-action";
import { toLocalInputValue } from "@/lib/time";

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
  defaultAlertCount,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InboxItem;
  timezone: string;
  defaultLeadMinutes: number;
  defaultAlertCount: number;
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
          // The one "Alert me" setting, the same as for meetings added by themselves.
          leadMinutes: defaultLeadMinutes,
          alertCount: defaultAlertCount,
          repeat: "none",
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
