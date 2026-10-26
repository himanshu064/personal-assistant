import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { downloadJson, exportChat, exportFileName } from "@/lib/projects/transfer";

/** Downloads one chat (a project's or a quick chat) as a JSON file another account can import. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/chats/[threadId]/export">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { threadId } = await ctx.params;
  if (!z.uuid().safeParse(threadId).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await exportChat(session.user.id, threadId);
  if (!result) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  return downloadJson(result.file, exportFileName(result.title));
}
