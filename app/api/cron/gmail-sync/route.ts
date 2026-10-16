import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { gmailSync } from "@/db/schema";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncGmail } from "@/lib/gmail/sync";

export const maxDuration = 60;

/**
 * How often the cron-job.org job calls this route, from GMAIL_SYNC_INTERVAL_MINUTES
 * (default 1440: once a day, at 6 AM IST).
 */
function intervalMinutes(): number {
  const n = Number(process.env.GMAIL_SYNC_INTERVAL_MINUTES ?? 1440);
  return Number.isFinite(n) && n > 0 ? n : 1440;
}

/** Gmails per run, synced a few at a time; the rest wait for the next run. */
const ACCOUNTS_PER_RUN = 20;
const AT_ONCE = 4;
/** Stop starting new syncs after this: one group can take about 25 seconds, and the run must end inside maxDuration. */
const TIME_BUDGET_MS = 30_000;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Active connections not synced since the last run, oldest first. One minute of slack, so a run that
  // started a little late does not skip a Gmail. At most an hour: with a daily run, an evening "Sync now"
  // must not make the next morning's run skip that Gmail. A Gmail with more mail left to read keeps an
  // older sync position, so a second run a few minutes later carries on with it.
  const recent = Math.min(Math.max(intervalMinutes() - 1, 1), 60);
  const due = await db
    .select({ accountId: gmailSync.accountId })
    .from(gmailSync)
    .where(
      and(
        eq(gmailSync.status, "active"),
        or(isNull(gmailSync.lastSyncedAt), lt(gmailSync.lastSyncedAt, sql`now() - make_interval(mins => ${recent})`)),
      ),
    )
    .orderBy(sql`${gmailSync.lastSyncedAt} asc nulls first`, asc(gmailSync.accountId))
    .limit(ACCOUNTS_PER_RUN);

  const started = Date.now();
  const totals = { accounts: 0, synced: 0, suggested: 0, failed: 0 };
  for (let i = 0; i < due.length && Date.now() - started < TIME_BUDGET_MS; i += AT_ONCE) {
    const results = await Promise.all(due.slice(i, i + AT_ONCE).map((a) => syncGmail(a.accountId)));
    for (const r of results) {
      totals.accounts++;
      if (r.ok) {
        totals.synced++;
        totals.suggested += r.suggested;
      } else if (r.reason !== "busy") totals.failed++;
    }
  }
  return NextResponse.json(totals);
}

// cron-job.org can send either method; Vercel Cron sends GET.
export const GET = handle;
export const POST = handle;
