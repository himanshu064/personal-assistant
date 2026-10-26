import { NextResponse, type NextRequest } from "next/server";
import { replyInChat } from "@/lib/chat/reply";
import { getMyProjects } from "@/lib/data/projects";
import { getMyUpcomingReminders } from "@/lib/data/reminders";
import { getSession } from "@/lib/session";
import { formatReminderTime } from "@/lib/time";

export const maxDuration = 60;

/**
 * A quick chat (the Chat section): a general assistant, not tied to a
 * project. It knows the user's upcoming reminders and project names, so
 * "what do I have today?" works here too. It can be moved into a project later.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [body, upcoming, projects] = await Promise.all([req.json().catch(() => null), getMyUpcomingReminders(15), getMyProjects()]);

  return replyInChat({
    userId: session.user.id,
    projectId: null,
    body,
    instructions: (context) => {
      const timeZone = context.timezone ?? "UTC";
      const today = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date());
      return (
        "You are the user's personal assistant in a quick chat. Answer questions, help them think, write and plan.\n" +
        "- Keep replies short and clear. Use Markdown (bold, lists, tables) only when it makes the answer clearer.\n" +
        "- For questions about their schedule, use the upcoming reminders below. If you do not know, say so. Never invent facts.\n" +
        "- Messages are often spoken, and speech recognition can mishear names as common words. If a word reads oddly where a name fits, ask which name they meant.\n" +
        "- You cannot create reminders from this chat; if they ask for one, tell them to tap the mic and say it, or use New reminder.\n" +
        `Now: ${today} (${timeZone}).\n\n` +
        `Upcoming reminders:\n${upcoming.map((r) => `- ${r.title}: ${formatReminderTime(new Date(r.remindAt), timeZone)}`).join("\n") || "(none)"}\n\n` +
        `Their projects: ${projects.map((p) => p.name).join(", ") || "(none)"}`
      );
    },
  });
}
