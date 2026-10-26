import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { replyInChat } from "@/lib/chat/reply";
import { memoryTag } from "@/lib/data/projects";
import { updateProjectMemory } from "@/lib/projects/memory";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

/**
 * Project chat, like a normal assistant chat: the user tells it things about
 * the project and asks about them. Each reply sends the project memory (facts
 * from all of this project's chats) and this chat's recent messages; after
 * the reply, the memory is updated in the background with the cheap model.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/projects/[projectId]/chat">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { projectId } = await ctx.params;
  if (!z.uuid().safeParse(projectId).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const [[project], body] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, description: projects.description, memory: projects.memory })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1),
    req.json().catch(() => null),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return replyInChat({
    userId,
    projectId,
    body,
    instructions: (context) => {
      const today = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: context.timezone ?? "UTC" }).format(new Date());
      return (
        `You are the user's personal assistant for their project "${project.name}"` +
        (project.description ? ` (${project.description})` : "") +
        ". The user tells you things about this project, often by voice, and asks you about them.\n" +
        "- When they share information, confirm it briefly. When it helps, show a running summary, for example a Markdown table of who gave whom how much.\n" +
        "- When they ask, answer from the project memory and this conversation. Do the arithmetic carefully and show the parts of a total.\n" +
        "- If something is unclear (for example, whether money was a loan or a gift), say what you assumed, in one line.\n" +
        "- Messages are often spoken, and speech recognition mishears names as common words ('Lakshay' as 'lecture'). " +
        "When a word sounds like a name in the project memory and fits as a name, read it as that name and use it. " +
        "If it could be a new person, ask in one line.\n" +
        "- If you do not know, say so. Never invent facts.\n" +
        "- Keep replies short. Use Markdown (bold, lists, tables) only when it makes the answer clearer.\n" +
        `Today is ${today}.\n\n` +
        "Project memory (facts from all chats in this project, kept up to date):\n" +
        `<project_memory>\n${project.memory || "(empty: nothing saved yet)"}\n</project_memory>`
      );
    },
    // Fold anything new from this exchange into the project memory, with the cheap model.
    afterAnswer: async ({ question, answer, context }) => {
      const model = context.cheapModel ?? context.model;
      if (model && (await updateProjectMemory({ projectId, model, userText: question, assistantText: answer }))) {
        revalidateTag(memoryTag(projectId), { expire: 0 });
      }
    },
  });
}
