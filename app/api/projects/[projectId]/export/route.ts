import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { downloadJson, exportFileName, exportProject } from "@/lib/projects/transfer";

/** Downloads the project (memory and every chat) as a JSON file another account can import. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[projectId]/export">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  if (!z.uuid().safeParse(projectId).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const file = await exportProject(session.user.id, projectId);
  if (!file || file.kind !== "project") return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return downloadJson(file, exportFileName(file.project.name));
}
