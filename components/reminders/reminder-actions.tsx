"use client";

import { useTransition } from "react";
import { AlarmClockIcon, CheckIcon, MoreHorizontalIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
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

/** The menu on each reminder: done, snooze, edit, delete. */
export function ReminderActions({ reminder, onEdit }: { reminder: ReminderRow; onEdit: (r: ReminderRow) => void }) {
  const [pending, startTransition] = useTransition();
  const isOpen = reminder.status === "pending";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await safeAction(action);
      toast.add(result.ok ? { title: success, type: "success" } : { title: result.error ?? "Try again.", type: "error" });
    });
  }

  return (
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
              <DropdownMenuItem onClick={() => run(() => snoozeReminder(reminder.id, "10m"), "Snoozed for 10 minutes")}>
                <AlarmClockIcon />
                10 minutes
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
        <DropdownMenuItem variant="destructive" onClick={() => run(() => deleteReminder(reminder.id), "Reminder deleted")}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
