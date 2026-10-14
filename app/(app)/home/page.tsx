import Link from "next/link";
import { Suspense } from "react";
import { AlarmClockIcon, BellIcon, CalendarCheckIcon, CircleCheckIcon, ListChecksIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/app-shell/page";
import { NewReminder } from "@/components/reminders/new-reminder";
import { NewReminderButton } from "@/components/reminders/new-reminder-button";
import { NotificationsPrompt } from "@/components/reminders/notifications-prompt";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyReminderStats, getMyUpcomingReminders } from "@/lib/data/reminders";
import { getMySettings } from "@/lib/data/settings";
import { requireUser } from "@/lib/session";
import { formatRelative, formatReminderTime, fromLocalInputValue, isPast, toLocalInputValue } from "@/lib/time";

export default function DashboardPage() {
  return (
    <Page
      title="Home"
      description={
        <Suspense fallback={<span className="inline-block h-4 w-56 animate-pulse rounded bg-muted align-middle" />}>
          <Greeting />
        </Suspense>
      }
      actions={
        <>
          <NewReminderButton />
          <Button size="page" variant="outline" nativeButton={false} render={<Link href="/reminders" />}>
            <ListChecksIcon strokeWidth={1.5} />
            All reminders
          </Button>
        </>
      }
    >
      <NotificationsPrompt />

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick capture</CardTitle>
            <CardDescription>Say it the way you would tell a friend.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewReminder />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Up next</CardTitle>
            <CardDescription>Your next five reminders.</CardDescription>
            <CardAction>
              <Link href="/reminders" className="text-sm font-medium underline-offset-4 hover:underline">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ListSkeleton />}>
              <UpNext />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

function partOfDay(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

async function Greeting() {
  const [user, settings] = await Promise.all([requireUser(), getMySettings()]);
  const timeZone = settings.timezone ?? "UTC";
  const today = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(new Date());
  return (
    <>
      {partOfDay(timeZone)}, {user.name.split(/\s+/)[0]}. Today is {today}.
    </>
  );
}

async function Stats() {
  const settings = await getMySettings();
  const timeZone = settings.timezone ?? "UTC";
  const today = toLocalInputValue(new Date(), timeZone).slice(0, 10);
  const endOfToday = fromLocalInputValue(`${today}T23:59`, timeZone) ?? new Date();
  const [stats, [next]] = await Promise.all([getMyReminderStats(endOfToday), getMyUpcomingReminders(1)]);

  const cards = [
    { title: "Due today", value: stats.dueToday, hint: "Still to do before midnight", icon: CalendarCheckIcon },
    { title: "Upcoming", value: stats.upcoming, hint: "Scheduled and not done yet", icon: BellIcon },
    { title: "Done this week", value: stats.doneThisWeek, hint: "Marked done in the last 7 days", icon: CircleCheckIcon },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} size="sm">
          <CardHeader>
            <CardTitle className="text-[15px] text-muted-foreground">{c.title}</CardTitle>
            <CardAction>
              <c.icon className="size-[18px] text-muted-foreground" strokeWidth={1.5} aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-4xl tracking-tight tabular-nums">{c.value}</span>
            <span className="text-xs text-muted-foreground">{c.hint}</span>
          </CardContent>
        </Card>
      ))}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-[15px] text-muted-foreground">Next reminder</CardTitle>
          <CardAction>
            <AlarmClockIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-1">
          {next ? (
            <>
              <span className="truncate text-xl">{next.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatReminderTime(new Date(next.remindAt), next.timezone)}, {formatRelative(new Date(next.remindAt))}
              </span>
            </>
          ) : (
            <>
              <span className="text-xl">Nothing scheduled</span>
              <span className="text-xs text-muted-foreground">Use Quick capture to add one</span>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function UpNext() {
  const upcoming = await getMyUpcomingReminders(5);
  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border bg-background">
          <BellIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} aria-hidden />
        </span>
        <p className="text-[15px]">Nothing coming up</p>
        <p className="text-sm text-muted-foreground">Say or type a reminder in Quick capture.</p>
      </div>
    );
  }
  return (
    <ul className="-my-1 flex flex-col divide-y divide-dashed">
      {upcoming.map((r) => {
        const at = new Date(r.remindAt);
        const overdue = isPast(at);
        return (
          <li key={r.id}>
            <Link
              href={`/reminders?r=${r.id}`}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background">
                <BellIcon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px]">{r.title}</span>
                <span className="text-xs text-muted-foreground">{formatReminderTime(at, r.timezone)}</span>
              </span>
              <Badge variant={overdue ? "warning" : "info"} className="shrink-0">
                {formatRelative(at)}
              </Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
