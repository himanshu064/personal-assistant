import type { Metadata } from "next";
import { Suspense } from "react";
import { Page } from "@/components/app-shell/page";
import { ConnectGmail, linkErrorMessage } from "@/components/inbox/connect-gmail";
import { InboxActions } from "@/components/inbox/inbox-actions";
import { InboxView } from "@/components/inbox/inbox-view";
import { ReconnectBanner } from "@/components/inbox/reconnect-banner";
import { SyncWatcher } from "@/components/inbox/sync-watcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getMyGmails, getMyInbox, type GmailConnection, type InboxStatus } from "@/lib/data/inbox";
import { getMyGoogleClient, getMySettings } from "@/lib/data/settings";
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

function listEmails(gmails: GmailConnection[]) {
  const emails = gmails.map((g) => g.email ?? "a new Gmail");
  return emails.length <= 1 ? (emails[0] ?? "your Gmail") : `${emails.slice(0, -1).join(", ")} and ${emails.at(-1)}`;
}

async function StatusLine() {
  const gmails = await getMyGmails();
  if (gmails.length === 0) return <>Meetings and deadlines found in your Gmail.</>;
  // The least recently checked Gmail, so the line never claims more than is true.
  const synced = gmails.map((g) => g.lastSyncedAt).filter((d): d is Date => d !== null);
  const oldest = synced.length === gmails.length ? new Date(Math.min(...synced.map((d) => new Date(d).getTime()))) : null;
  const checked = gmails.some((g) => g.syncing) ? "Checking now..." : oldest ? `Checked ${formatRelative(oldest)}.` : "First check starting...";
  return (
    <>
      Suggestions from {listEmails(gmails)}. {checked}
    </>
  );
}

async function HeaderActions() {
  const gmails = await getMyGmails();
  return gmails.length > 0 ? (
    <InboxActions canSync={gmails.some((g) => g.status === "active")} accounts={gmails.map((g) => ({ accountId: g.accountId, email: g.email }))} />
  ) : null;
}

async function InboxContent({ searchParams }: { searchParams: PageProps<"/inbox">["searchParams"] }) {
  const sp = await searchParams;
  const gmails = await getMyGmails();
  const errorCode = typeof sp.error === "string" ? sp.error : undefined;
  if (gmails.length === 0) {
    const google = await getMyGoogleClient();
    return <ConnectGmail failed={sp.gmail_error !== undefined} errorCode={errorCode} googleReady={google !== null} />;
  }

  const status: InboxStatus = sp.status === "added" || sp.status === "dismissed" ? sp.status : "new";
  const [{ items, counts }, settings] = await Promise.all([getMyInbox(status), getMySettings()]);

  // A Gmail whose first sync has not finished. Show progress only while it runs (or is about to start, right
  // after connecting); a first sync that failed shows the Inbox as it is and is retried by the next run.
  const syncing = gmails.some((g) => g.syncing);
  const firstSyncs = gmails.filter((g) => g.status === "active" && !g.lastSyncedAt && (g.syncing || sp.connected === "1"));
  const nothingSyncedYet = gmails.every((g) => !g.lastSyncedAt);

  return (
    <>
      <SyncWatcher syncing={syncing || firstSyncs.length > 0} justConnected={sp.connected === "1"} />
      {sp.gmail_error !== undefined ? (
        <p role="alert" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-destructive">
          {linkErrorMessage(errorCode)}
        </p>
      ) : null}
      {gmails.map((g) =>
        g.status === "needs_reconnect" ? (
          <ReconnectBanner key={g.accountId} problem={g.problem} email={g.email} />
        ) : g.problem ? (
          <p key={g.accountId} role="status" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
            {g.email ? `${g.email}: ` : null}
            {g.problem}
          </p>
        ) : null,
      )}
      {firstSyncs.length > 0 && nothingSyncedYet ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-16 text-center framed" aria-live="polite">
          <Spinner className="size-6" />
          <p>Reading the last 30 days of your email</p>
          <p className="max-w-sm text-sm text-muted-foreground">This takes up to a minute. Suggestions appear here on their own.</p>
        </div>
      ) : (
        <>
          {firstSyncs.length > 0 ? (
            <p role="status" className="flex items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm" aria-live="polite">
              <Spinner />
              Reading the last 30 days of your new Gmail. Its suggestions appear here on their own.
            </p>
          ) : null}
          <InboxView
            status={status}
            items={items}
            counts={counts}
            timezone={settings.timezone ?? "UTC"}
            defaultLeadMinutes={settings.defaultLeadMinutes}
            initialItemId={typeof sp.item === "string" ? sp.item : undefined}
            showAccount={gmails.length > 1}
          />
        </>
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
