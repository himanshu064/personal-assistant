"use client";

import { useMemo, useState } from "react";
import { MicIcon, PenLineIcon, RepeatIcon } from "lucide-react";
import { cn } from "cn";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { DataTable, dataTableColumns } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { updateReminder } from "@/app/(app)/reminders/actions";
import type { ReminderRow } from "@/lib/data/reminders";
import { formatRelative, formatReminderTime, isPast, toLocalInputValue } from "@/lib/time";
import { repeatLabel } from "@/lib/reminders/repeat";
import { safeAction } from "@/lib/safe-action";
import { ReminderActions } from "./reminder-actions";
import { ReminderForm } from "./reminder-form";

function StatusBadge({ reminder }: { reminder: ReminderRow }) {
  if (reminder.status === "done") return <Badge variant="neutral">Done</Badge>;
  if (reminder.status === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  if (reminder.notifiedAt) return <Badge variant="success">Sent</Badge>;
  if (isPast(new Date(reminder.remindAt))) return <Badge variant="warning">Overdue</Badge>;
  return <Badge variant="info">Scheduled</Badge>;
}

function When({ reminder }: { reminder: ReminderRow }) {
  const at = new Date(reminder.remindAt);
  return (
    <div className="flex flex-col">
      <span>{formatReminderTime(at, reminder.timezone)}</span>
      {reminder.status === "pending" ? <span className="text-xs text-muted-foreground">{formatRelative(at)}</span> : null}
      {reminder.repeat !== "none" ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <RepeatIcon className="size-3" aria-hidden />
          {repeatLabel(reminder.repeat, toLocalInputValue(at, reminder.timezone))}
        </span>
      ) : null}
    </div>
  );
}

function SourceIcon({ source }: { source: ReminderRow["source"] }) {
  const Icon = source === "voice" ? MicIcon : PenLineIcon;
  return <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-label={source === "voice" ? "Spoken" : "Typed"} />;
}

export function RemindersTable({
  rows,
  total,
  page,
  pageSize,
  highlightId,
  emptyMessage,
  filters,
}: {
  rows: ReminderRow[];
  total: number;
  page: number;
  pageSize: number;
  highlightId?: string;
  emptyMessage: React.ReactNode;
  /** Controls shown in the table toolbar, next to search. */
  filters?: React.ReactNode;
}) {
  const [editing, setEditing] = useState<ReminderRow | null>(null);

  const columns = useMemo(() => {
    const col = dataTableColumns<ReminderRow>();
    return [
      col.accessor("title", {
        header: "Reminder",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-start gap-2">
            <SourceIcon source={row.original.source} />
            <div className="min-w-0">
              <p className={cn("whitespace-normal", row.original.id === highlightId && "underline decoration-2 underline-offset-4")}>
                {row.original.title}
              </p>
              {row.original.notes ? (
                <p className="line-clamp-1 text-xs whitespace-normal text-muted-foreground">{row.original.notes}</p>
              ) : null}
            </div>
          </div>
        ),
      }),
      col.accessor("remindAt", { header: "When", size: 200, cell: ({ row }) => <When reminder={row.original} /> }),
      col.display({ id: "status", header: "Status", size: 110, cell: ({ row }) => <StatusBadge reminder={row.original} /> }),
      col.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        size: 56,
        cell: ({ row }) => <ReminderActions reminder={row.original} onEdit={setEditing} />,
      }),
    ];
  }, [highlightId]);

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        totalCount={total}
        currentPage={page}
        pageSize={pageSize}
        searchPlaceholder="Search reminders"
        filters={filters}
        stickyColumns={[]}
        emptyMessage={emptyMessage}
        renderMobileRow={(row) => (
          <div
            className={cn(
              "flex items-start gap-3 px-4 py-3",
              row.original.id === highlightId && "bg-muted/60",
            )}
          >
            <SourceIcon source={row.original.source} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p>{row.original.title}</p>
              {row.original.notes ? <p className="line-clamp-2 text-sm text-muted-foreground">{row.original.notes}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <When reminder={row.original} />
                <StatusBadge reminder={row.original} />
              </div>
            </div>
            <ReminderActions reminder={row.original} onEdit={setEditing} />
          </div>
        )}
      />

      <ResponsiveModal open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title="Edit reminder">
        {editing ? (
          <ReminderForm
            key={editing.id}
            defaultValues={{
              title: editing.title,
              remindAt: toLocalInputValue(new Date(editing.remindAt), editing.timezone),
              notes: editing.notes ?? "",
              leadMinutes: editing.leadMinutes,
              alertCount: editing.alertCount,
              repeat: editing.repeat,
            }}
            timezone={editing.timezone}
            submitLabel="Save changes"
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              const result = await safeAction(() => updateReminder(editing.id, { ...values, timezone: editing.timezone }));
              if (result.ok) {
                toast.add({ title: "Reminder updated", type: "success" });
                setEditing(null);
              }
              return result;
            }}
          />
        ) : null}
      </ResponsiveModal>
    </>
  );
}
