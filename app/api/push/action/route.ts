import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { remindersTag } from "@/lib/data/reminders";
import { completeReminder } from "@/lib/reminders/complete";
import { snoozeReminderFor } from "@/lib/reminders/snooze";
import { getSession } from "@/lib/session";

const bodySchema = z.object({ id: z.uuid(), action: z.enum(["done", "snooze"]) });

/**
 * The notification's buttons, called by the service worker with the user's
 * cookies. "done" also stops any alerts still to come (a repeating reminder
 * moves to its next date); "snooze" alerts once more in 15 minutes.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, action } = parsed.data;
  const userId = session.user.id;

  // Done on a repeating reminder moves it to its next date (lib/reminders/complete.ts).
  const ok = action === "snooze" ? await snoozeReminderFor(userId, id, "15m") : (await completeReminder(userId, id)).found;
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidateTag(remindersTag(userId), { expire: 0 });
  return NextResponse.json({ ok: true });
}
