"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  BellPlusIcon,
  CalendarIcon,
  CheckIcon,
  ExternalLinkIcon,
  InboxIcon,
  LinkIcon,
  MapPinIcon,
  MousePointerClickIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { setSuggestionStatus } from "@/app/(app)/inbox/actions";
import type { InboxCounts, InboxItem, InboxStatus } from "@/lib/data/inbox";
import { safeAction } from "@/lib/safe-action";
import { formatRelative, formatReminderTime } from "@/lib/time";
import { CreateFromSuggestion } from "./create-from-suggestion";

type Kind = InboxItem["kind"];

const STATUS_LABELS: Record<InboxStatus, string> = { new: "New", added: "Added", dismissed: "Dismissed" };
const KINDS: { kind: Kind; label: string; dot: string }[] = [
  { kind: "meeting", label: "Meetings", dot: "bg-[#2f6fd6]" },
  { kind: "reminder", label: "Reminders", dot: "bg-[#3f7d3a]" },
  { kind: "deadline", label: "Deadlines", dot: "bg-[#d2642a]" },
];
const KIND_LABEL: Record<Kind, string> = { meeting: "Meeting", reminder: "Reminder", deadline: "Deadline" };

const EMPTY: Record<InboxStatus, { title: string; description: string }> = {
  new: { title: "No new suggestions", description: "Meetings and deadlines found in your email appear here. The next check runs within 30 minutes." },
  added: { title: "Nothing added yet", description: "Suggestions you turn into reminders move here." },
  dismissed: { title: "Nothing dismissed", description: "Suggestions you dismiss move here, in case you change your mind." },
};

/**
 * The Inbox, in three panes like the reference (filters, list, details).
 * Filtering by type, searching and selecting happen in the browser, so they
 * are instant; switching status loads that list from the server.
 */
export function InboxView({
  status,
  items,
  counts,
  timezone,
  defaultLeadMinutes,
  initialItemId,
  gmailAddress,
}: {
  status: InboxStatus;
  items: InboxItem[];
  counts: InboxCounts;
  timezone: string;
  defaultLeadMinutes: number;
  initialItemId?: string;
  gmailAddress: string | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItemId && items.some((i) => i.id === initialItemId) ? initialItemId : null,
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (!q || `${i.title} ${i.subject} ${i.fromName} ${i.fromAddress} ${i.snippet}`.toLowerCase().includes(q)),
    );
  }, [items, kind, query]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  function select(id: string | null) {
    setSelectedId(id);
    // Keep the URL shareable without a server round trip.
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("item", id);
    else url.searchParams.delete("item");
    window.history.replaceState(null, "", url);
  }

  const statusHref = (s: InboxStatus) => (s === "new" ? "/inbox" : `/inbox?status=${s}`);

  return (
    <div className="overflow-hidden rounded-xl bg-card framed lg:grid lg:h-[calc(100dvh-15rem)] lg:min-h-[34rem] lg:grid-cols-[13rem_22rem_minmax(0,1fr)]">
      {/* Filters: a column on desktop. */}
      <nav aria-label="Suggestion filters" className="hidden flex-col gap-1 border-r p-3 lg:flex">
        {(Object.keys(STATUS_LABELS) as InboxStatus[]).map((s) => (
          <Link
            key={s}
            href={statusHref(s)}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "flex h-9 items-center justify-between rounded-lg px-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40",
              s === status && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {STATUS_LABELS[s]}
            <span className={cn("text-xs tabular-nums", s === status ? "text-primary-foreground/80" : "text-muted-foreground")}>{counts[s]}</span>
          </Link>
        ))}
        <div className="my-2 border-t" />
        <button
          type="button"
          onClick={() => setKind("all")}
          aria-pressed={kind === "all"}
          className={cn("flex h-9 items-center rounded-lg px-3 text-left text-sm hover:bg-muted", kind === "all" && "bg-muted")}
        >
          All types
        </button>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setKind(k.kind)}
            aria-pressed={kind === k.kind}
            className={cn("flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-muted", kind === k.kind && "bg-muted")}
          >
            <span className={cn("size-2.5 rounded-full", k.dot)} aria-hidden />
            <span className="flex-1">{k.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{counts[k.kind]}</span>
          </button>
        ))}
      </nav>

      {/* List. On phones it hides while a suggestion is open. */}
      <section aria-label="Suggestions" className={cn("flex min-h-0 flex-col border-r", selected && "hidden lg:flex")}>
        <div className="flex flex-col gap-2 border-b p-3">
          <div className="flex gap-2 lg:hidden">
            <NativeSelect aria-label="Status" className="flex-1" value={status} onChange={(e) => router.push(statusHref(e.target.value as InboxStatus))}>
              {(Object.keys(STATUS_LABELS) as InboxStatus[]).map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {STATUS_LABELS[s]} ({counts[s]})
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Type" className="flex-1" value={kind} onChange={(e) => setKind(e.target.value as Kind | "all")}>
              <NativeSelectOption value="all">All types</NativeSelectOption>
              {KINDS.map((k) => (
                <NativeSelectOption key={k.kind} value={k.kind}>
                  {k.label} ({counts[k.kind]})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search suggestions" className="pl-9" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {visible.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title={query || kind !== "all" ? "No matches" : EMPTY[status].title}
              description={query || kind !== "all" ? "Try another search or type." : EMPTY[status].description}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((item) => (
                <li key={item.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                  <button
                    type="button"
                    onClick={() => select(item.id)}
                    aria-current={item.id === selectedId ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-xl border bg-background p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40",
                      item.id === selectedId && "border-foreground/30 bg-muted/60",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{item.fromName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(new Date(item.receivedAt))}</span>
                    </span>
                    <span className="truncate text-sm">{item.title}</span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">{item.snippet}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{KIND_LABEL[item.kind]}</Badge>
                      <Badge variant="outline">{item.startsAt ? formatReminderTime(new Date(item.startsAt), timezone) : "No date"}</Badge>
                      {item.foundBy === "invite" ? <Badge variant="outline">Invite</Badge> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Details. */}
      <section aria-label="Suggestion details" className={cn("min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}>
        {selected ? (
          <Details
            key={selected.id}
            item={selected}
            timezone={timezone}
            defaultLeadMinutes={defaultLeadMinutes}
            gmailAddress={gmailAddress}
            onBack={() => select(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MousePointerClickIcon className="size-7" strokeWidth={1.25} aria-hidden />
            <p>No suggestion selected</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Details({
  item,
  timezone,
  defaultLeadMinutes,
  gmailAddress,
  onBack,
}: {
  item: InboxItem;
  timezone: string;
  defaultLeadMinutes: number;
  gmailAddress: string | null;
  onBack: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  // authuser opens the connected mailbox even when several Google accounts are signed in.
  const gmailUrl = `https://mail.google.com/mail/${gmailAddress ? `?authuser=${encodeURIComponent(gmailAddress)}` : "u/0/"}#all/${item.gmailMessageId}`;

  function setStatus(next: "new" | "dismissed") {
    startTransition(async () => {
      const result = await safeAction(() => setSuggestionStatus(item.id, next));
      if (!result.ok) return void toast.add({ title: result.error, type: "error" });
      toast.add({ title: next === "dismissed" ? "Suggestion dismissed" : "Moved back to New", type: "success" });
      onBack();
    });
  }

  const initials = item.fromName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Back to suggestions" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        {item.status === "added" ? (
          <>
            <Badge variant="success" className="h-7 gap-1.5 px-3 text-sm">
              <CheckIcon />
              Reminder added
            </Badge>
            {item.reminderId ? (
              <Button size="page" variant="outline" nativeButton={false} render={<Link href={`/reminders?r=${item.reminderId}`} />}>
                View reminder
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button size="page" onClick={() => setCreating(true)} disabled={pending}>
              <BellPlusIcon strokeWidth={1.5} />
              Create reminder
            </Button>
            <Button size="page" variant="outline" disabled={pending} onClick={() => setStatus(item.status === "dismissed" ? "new" : "dismissed")}>
              {pending ? <Spinner /> : item.status === "dismissed" ? <RotateCcwIcon strokeWidth={1.5} /> : <XIcon strokeWidth={1.5} />}
              {item.status === "dismissed" ? "Restore" : "Dismiss"}
            </Button>
          </>
        )}
        <Button
          size="page"
          variant="ghost"
          className="ml-auto"
          nativeButton={false}
          render={<a href={gmailUrl} target="_blank" rel="noreferrer" />}
        >
          Open in Gmail
          <ExternalLinkIcon strokeWidth={1.5} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium" aria-hidden>
            {initials || "?"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-medium">{item.fromName}</p>
              <time className="text-xs text-muted-foreground" dateTime={new Date(item.receivedAt).toISOString()}>
                {formatReminderTime(new Date(item.receivedAt), timezone)}
              </time>
            </div>
            <p className="text-sm">{item.subject}</p>
            <p className="truncate text-xs text-muted-foreground">{item.fromAddress}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {item.foundBy === "invite" ? "Read from the calendar invite" : "Found by your AI. Check the details before saving."}
            </p>
            <Badge>{KIND_LABEL[item.kind]}</Badge>
          </div>
          <p className="text-lg tracking-tight">{item.title}</p>
          <dl className="flex flex-col gap-2 text-sm">
            <Fact icon={CalendarIcon} label="When">
              {item.startsAt ? formatReminderTime(new Date(item.startsAt), timezone) : "No date in the email"}
            </Fact>
            {item.location ? (
              <Fact icon={MapPinIcon} label="Where">
                {item.location}
              </Fact>
            ) : null}
            {item.link ? (
              <Fact icon={LinkIcon} label="Link">
                <a href={item.link} target="_blank" rel="noreferrer" className="break-all underline underline-offset-4">
                  {item.link}
                </a>
              </Fact>
            ) : null}
          </dl>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">Preview from Gmail</p>
        <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">{item.snippet}</p>
      </div>

      <CreateFromSuggestion
        open={creating}
        onOpenChange={setCreating}
        item={item}
        timezone={timezone}
        defaultLeadMinutes={defaultLeadMinutes}
        onCreated={onBack}
      />
    </>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof CalendarIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
