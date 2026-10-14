import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { processDueReminders } from "@/lib/reminders/process-due";

export const maxDuration = 60;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await processDueReminders());
}

// cron-job.org can send either method; Vercel Cron sends GET.
export const GET = handle;
export const POST = handle;
