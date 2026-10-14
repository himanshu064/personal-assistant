import { BellIcon, CalendarCheckIcon, CircleCheckIcon, FolderIcon, HouseIcon, InboxIcon, MicIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A static picture of the app (sample data, not live), shown under the hero.
 * Built from the same styles as the real app so it never goes out of date
 * visually. Hidden from screen readers; the page text says what it shows.
 */
export function AppPreview() {
  const upNext = [
    { title: "Call Ravi about the contract", when: "Today, 3:30 PM", rel: "in 2 hours", tone: "info" as const },
    { title: "Pay electricity bill", when: "Today, 6:30 PM", rel: "in 5 hours", tone: "info" as const },
    { title: "Water the plants", when: "Today, 1:00 PM", rel: "30 min ago", tone: "warning" as const },
  ];
  const nav = [
    { icon: HouseIcon, label: "Home", active: true },
    { icon: BellIcon, label: "Reminders" },
    { icon: InboxIcon, label: "Inbox" },
    { icon: FolderIcon, label: "Projects" },
    { icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <div aria-hidden className="pointer-events-none select-none rounded-[1.75rem] bg-sidebar p-2 text-left framed md:p-3">
      <div className="flex gap-3">
        {/* Sidebar */}
        <div className="hidden w-52 shrink-0 flex-col gap-3 p-2 md:flex">
          <div className="flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-[0_0_0_1px_var(--border)]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">RS</span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm">Riya Sharma</span>
              <span className="text-xs text-muted-foreground">Personal Assistant</span>
            </span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-xl bg-[#e9e9e6] px-3 text-sm text-muted-foreground">
            <SearchIcon className="size-4" strokeWidth={1.5} />
            Search
          </div>
          <p className="px-1 pt-1 text-sm">Essentials</p>
          <ul className="flex flex-col gap-1">
            {nav.map((n) => (
              <li
                key={n.label}
                className={
                  n.active
                    ? "flex h-9 items-center gap-2.5 rounded-xl bg-white px-3 text-sm shadow-[0_0_0_1px_var(--border)]"
                    : "flex h-9 items-center gap-2.5 px-3 text-sm text-foreground/75"
                }
              >
                <n.icon className="size-4" strokeWidth={1.5} />
                {n.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Page panel */}
        <div className="min-w-0 flex-1 rounded-2xl bg-background p-4 text-left shadow-[0_0_0_1px_var(--border)] md:p-6">
          <p className="text-sm text-muted-foreground">Home</p>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl tracking-tight md:text-4xl">Home</p>
              <p className="text-sm text-muted-foreground">Good afternoon, Riya.</p>
            </div>
            <span className="hidden h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm text-primary-foreground sm:flex">
              <BellIcon className="size-4" strokeWidth={1.5} />
              New reminder
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Due today", value: 3, icon: CalendarCheckIcon },
              { label: "Upcoming", value: 6, icon: BellIcon },
              { label: "Done this week", value: 4, icon: CircleCheckIcon },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-card p-3 framed">
                <div className="flex items-center justify-between text-xs text-muted-foreground sm:text-sm">
                  {c.label}
                  <c.icon className="hidden size-4 sm:block" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-2xl tracking-tight md:text-3xl">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="hidden flex-col items-center justify-center gap-3 rounded-xl bg-card p-5 framed md:col-span-2 md:flex">
              <span className="flex size-16 items-center justify-center rounded-full bg-live text-live-foreground shadow-[0_10px_24px_-8px_rgb(244_166_42/0.7)]">
                <MicIcon className="size-7" strokeWidth={1.75} />
              </span>
              <p className="text-sm">&ldquo;Remind me to call Ravi at 3:30&rdquo;</p>
            </div>
            <div className="rounded-xl bg-card p-4 framed md:col-span-3">
              <p className="text-sm">Up next</p>
              <ul className="mt-2 divide-y divide-dashed">
                {upNext.map((r) => (
                  <li key={r.title} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border">
                      <BellIcon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.when}</span>
                    </span>
                    <Badge variant={r.tone}>{r.rel}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
