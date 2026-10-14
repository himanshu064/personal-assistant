import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processDueReminders } from "@/lib/reminders/process-due";

export const maxDuration = 60;

/** Accepts `x-cron-secret: <secret>` (cron-job.org) or `Authorization: Bearer <secret>` (Vercel Cron). */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const result = await processDueReminders();
  return NextResponse.json(result);
}

// cron-job.org can send either method; Vercel Cron sends GET.
export const GET = handle;
export const POST = handle;
