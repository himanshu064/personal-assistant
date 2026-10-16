"use client";

import { useState, useTransition } from "react";
import { AlarmClockIcon, CheckIcon, MoreHorizontalIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { safeAction } from "@/lib/safe-action";
import { deleteReminder, setReminderStatus, snoozeReminder } from "@/app/(app)/reminders/actions";
import type { ReminderRow } from "@/lib/data/reminders";
import { formatReminderTime } from "@/lib/time";

/** The menu on each reminder: done, snooze, edit, delete. */
export function ReminderActions({ reminder, onEdit }: { reminder: ReminderRow; onEdit: (r: ReminderRow) => void }) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isOpen = reminder.status === "pending";

  function run(action: () => Promise<{ ok: boolean; error?: string; next?: string }>, success: string) {
    startTransition(async () => {
      const result = await safeAction(action);
      // A repeating reminder is done for this time and comes back on its next date.
      const next = result.ok && "next" in result && result.next ? `Done for now. Next: ${formatReminderTime(new Date(result.next), reminder.timezone)}` : null;
      toast.add(result.ok ? { title: next ?? success, type: "success" } : { title: result.error ?? "Try again.", type: "error" });
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              disabled={pending}
              aria-busy={pending}
              aria-label={pending ? `Updating ${reminder.title}` : `Actions for ${reminder.title}`}
            />
          }
        >
          {pending ? <Spinner /> : <MoreHorizontalIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {isOpen ? (
            <>
              <DropdownMenuItem onClick={() => run(() => setReminderStatus(reminder.id, "done"), "Marked as done")}>
                <CheckIcon />
                Mark as done
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Snooze</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => run(() => snoozeReminder(reminder.id, "15m"), "Snoozed for 15 minutes")}>
                  <AlarmClockIcon />
                  15 minutes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => run(() => snoozeReminder(reminder.id, "1h"), "Snoozed for 1 hour")}>
                  <AlarmClockIcon />
                  1 hour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => run(() => snoozeReminder(reminder.id, "tomorrow"), "Snoozed until tomorrow 9:00")}>
                  <AlarmClockIcon />
                  Tomorrow morning
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : (
            <DropdownMenuItem onClick={() => run(() => setReminderStatus(reminder.id, "pending"), "Moved back to upcoming")}>
              <RotateCcwIcon />
              Not done yet
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(reminder)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmingDelete(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deleting cannot be undone, so it asks first. */}
      <ResponsiveModal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this reminder?"
        description={`\u201c${reminder.title}\u201d will be deleted. This cannot be undone.`}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="page" onClick={() => setConfirmingDelete(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="page"
            onClick={() => {
              setConfirmingDelete(false);
              run(() => deleteReminder(reminder.id), "Reminder deleted");
            }}
          >
            <Trash2Icon strokeWidth={1.5} />
            Delete reminder
          </Button>
        </div>
      </ResponsiveModal>
    </>
  );
}
