import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Page } from "@/components/app-shell/page";
import { RemindersTabs } from "@/components/reminders/reminders-tabs";
import Link from "next/link";
import { BellIcon, CircleCheckIcon, SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { NotificationsPrompt } from "@/components/reminders/notifications-prompt";
import { RemindersTable } from "@/components/reminders/reminders-table";
import { TableSkeleton } from "@/components/common/skeletons";
import { parsePaging } from "@/lib/constants/table";
import { getMyReminders, type ReminderView } from "@/lib/data/reminders";

export const metadata: Metadata = { title: "Reminders" };

export default function RemindersPage(props: PageProps<"/reminders">) {
  return (
    <Page
      title="Reminders"
      description="Everything you asked your assistant to remember."
      tabs={
        <Suspense fallback={<div className="h-11 border-b" />}>
          <RemindersTabs />
        </Suspense>
      }
    >
      <NotificationsPrompt />
      {/* Reads the URL (view, page, search), so it streams in behind Suspense. */}
      <Suspense fallback={<TableSkeleton />}>
        <RemindersList searchParams={props.searchParams} />
      </Suspense>
    </Page>
  );
}

async function RemindersList({ searchParams }: { searchParams: PageProps<"/reminders">["searchParams"] }) {
  const params = await searchParams;
  const view: ReminderView = params.view === "done" ? "done" : "upcoming";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const { page, pageSize, offset } = parsePaging(params);
  const { rows, total } = await getMyReminders({ view, q, limit: pageSize, offset });

  // A page past the end (old link, or items were deleted): go back to page 1.
  if (rows.length === 0 && page > 1) {
    const next = new URLSearchParams();
    if (view === "done") next.set("view", "done");
    if (q) next.set("q", q);
    redirect(`/reminders${next.size ? `?${next}` : ""}`);
  }

  return (
    <RemindersTable
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      highlightId={typeof params.r === "string" ? params.r : undefined}
      emptyMessage={
        q ? (
          <EmptyState
            icon={SearchXIcon}
            title={`No reminders match “${q}”`}
            description="Try a shorter word, or check the other tab."
            action={
              <Button size="page" variant="outline" nativeButton={false} render={<Link href={view === "done" ? "/reminders?view=done" : "/reminders"} />}>
                Clear search
              </Button>
            }
          />
        ) : view === "upcoming" ? (
          <EmptyState
            icon={BellIcon}
            title="Nothing coming up"
            description="Tap the mic and say what you want to remember. It will show here."
          />
        ) : (
          <EmptyState icon={CircleCheckIcon} title="Nothing done yet" description="Reminders you mark as done move here." />
        )
      }
    />
  );
}
