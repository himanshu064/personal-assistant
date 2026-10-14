import type { Metadata } from "next";
import { Suspense } from "react";
import { Page } from "@/components/app-shell/page";
import { ConnectGmail } from "@/components/inbox/connect-gmail";
import { InboxActions } from "@/components/inbox/inbox-actions";
import { InboxView } from "@/components/inbox/inbox-view";
import { ReconnectBanner } from "@/components/inbox/reconnect-banner";
import { SyncWatcher } from "@/components/inbox/sync-watcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getMyGmail, getMyInbox, type InboxStatus } from "@/lib/data/inbox";
import { getMySettings } from "@/lib/data/settings";
import { formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage(props: PageProps<"/inbox">) {
  return (
    <Page
      title="Inbox"
      description={
        <Suspense fallback={<span className="inline-block h-4 w-72 animate-pulse rounded bg-muted align-middle" />}>
          <StatusLine />
        </Suspense>
      }
      actions={
        <Suspense fallback={null}>
          <HeaderActions />
        </Suspense>
      }
    >
      <Suspense fallback={<InboxSkeleton />}>
        <InboxContent searchParams={props.searchParams} />
      </Suspense>
    </Page>
  );
}

async function StatusLine() {
  const gmail = await getMyGmail();
  if (!gmail) return <>Meetings and deadlines found in your Gmail.</>;
  const checked = gmail.syncing
    ? "Checking now..."
    : gmail.lastSyncedAt
      ? `Checked ${formatRelative(new Date(gmail.lastSyncedAt))}.`
      : "First check starting...";
  return (
    <>
      Suggestions from {gmail.email ?? "your Gmail"}. {checked}
    </>
  );
}

async function HeaderActions() {
  const gmail = await getMyGmail();
  return gmail ? <InboxActions canSync={gmail.status === "active"} /> : null;
}

async function InboxContent({ searchParams }: { searchParams: PageProps<"/inbox">["searchParams"] }) {
  const sp = await searchParams;
  const gmail = await getMyGmail();
  if (!gmail) return <ConnectGmail failed={sp.gmail_error !== undefined} errorCode={typeof sp.error === "string" ? sp.error : undefined} />;

  const status: InboxStatus = sp.status === "added" || sp.status === "dismissed" ? sp.status : "new";
  const [{ items, counts }, settings] = await Promise.all([getMyInbox(status), getMySettings()]);
  // The first sync has not finished yet. Show progress only while it runs (or is about to start, right
  // after connecting); a first sync that failed shows the empty Inbox and is retried by the next run.
  const firstSync = gmail.status === "active" && !gmail.lastSyncedAt;
  const firstSyncRunning = firstSync && (gmail.syncing || sp.connected === "1");

  return (
    <>
      <SyncWatcher syncing={gmail.syncing || firstSyncRunning} justConnected={sp.connected === "1"} />
      {gmail.status === "needs_reconnect" ? <ReconnectBanner problem={gmail.problem} /> : null}
      {gmail.status === "active" && gmail.problem ? (
        <p role="status" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
          {gmail.problem}
        </p>
      ) : null}
      {firstSyncRunning ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-16 text-center framed" aria-live="polite">
          <Spinner className="size-6" />
          <p>Reading the last 30 days of your email</p>
          <p className="max-w-sm text-sm text-muted-foreground">This takes up to a minute. Suggestions appear here on their own.</p>
        </div>
      ) : (
        <InboxView
          status={status}
          items={items}
          counts={counts}
          timezone={settings.timezone ?? "UTC"}
          defaultLeadMinutes={settings.defaultLeadMinutes}
          initialItemId={typeof sp.item === "string" ? sp.item : undefined}
          gmailAddress={gmail.email}
        />
      )}
    </>
  );
}

function InboxSkeleton() {
  return (
    <div aria-busy aria-label="Loading" className="grid overflow-hidden rounded-xl bg-card framed lg:h-[calc(100dvh-15rem)] lg:grid-cols-[13rem_22rem_minmax(0,1fr)]">
      <div className="hidden flex-col gap-2 border-r p-3 lg:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-r p-3">
        <Skeleton className="h-10 rounded-xl" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="hidden p-5 lg:block">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-5 h-40 rounded-xl" />
      </div>
    </div>
  );
}
