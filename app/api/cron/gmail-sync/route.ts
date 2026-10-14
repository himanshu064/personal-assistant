import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { gmailSync } from "@/db/schema";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncGmail } from "@/lib/gmail/sync";

export const maxDuration = 60;

/** Users per run, synced a few at a time; the rest wait for the next run (every 30 minutes). */
const USERS_PER_RUN = 20;
const AT_ONCE = 4;
/** Stop starting new syncs after this: one group can take about 25 seconds, and the run must end inside maxDuration. */
const TIME_BUDGET_MS = 30_000;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Active connections not synced in the last 25 minutes ("Sync now" counts), oldest first.
  const due = await db
    .select({ userId: gmailSync.userId })
    .from(gmailSync)
    .where(
      and(
        eq(gmailSync.status, "active"),
        or(isNull(gmailSync.lastSyncedAt), lt(gmailSync.lastSyncedAt, sql`now() - interval '25 minutes'`)),
      ),
    )
    .orderBy(sql`${gmailSync.lastSyncedAt} asc nulls first`, asc(gmailSync.userId))
    .limit(USERS_PER_RUN);

  const started = Date.now();
  const totals = { users: 0, synced: 0, suggested: 0, failed: 0 };
  for (let i = 0; i < due.length && Date.now() - started < TIME_BUDGET_MS; i += AT_ONCE) {
    const results = await Promise.all(due.slice(i, i + AT_ONCE).map((u) => syncGmail(u.userId)));
    for (const r of results) {
      totals.users++;
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
