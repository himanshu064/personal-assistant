import { deleteReminder } from "@/app/(app)/reminders/actions";
import { toast } from "@/components/ui/toast";
import { formatReminderTime } from "@/lib/time";
import { safeAction } from "@/lib/safe-action";

/** "Reminder saved" with Undo, for reminders saved straight from what the user said. */
export function showSavedReminder(saved: { id: string; title: string; remindAt: string; timezone: string }) {
  toast.add({
    title: `Reminder saved: ${saved.title}`,
    description: formatReminderTime(new Date(saved.remindAt), saved.timezone),
    type: "success",
    timeout: 8000,
    actionProps: {
      children: "Undo",
      onClick: () =>
        void safeAction(() => deleteReminder(saved.id)).then((r) =>
          toast.add(r.ok ? { title: "Reminder removed", type: "success" } : { title: r.error, type: "error" }),
        ),
    },
  });
}
