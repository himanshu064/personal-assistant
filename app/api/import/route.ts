import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { chatListTags } from "@/lib/chat/reply";
import { projectsTag } from "@/lib/data/projects";
import { exportFileSchema, importFile, MAX_IMPORT_BYTES, type ImportTarget } from "@/lib/projects/transfer";
import { getSession } from "@/lib/session";

/**
 * Imports an exported JSON file into the signed in account. A route, not a
 * Server Action, because those refuse bodies over 1 MB.
 * ?into=projects: a project file becomes a new project.
 * ?into=chat: a chat file becomes a quick chat. ?into=<project id>: a chat file joins that project.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const into = req.nextUrl.searchParams.get("into") ?? "";
  let target: ImportTarget;
  if (into === "projects") target = { kind: "projects" };
  else if (into === "chat") target = { kind: "chat", projectId: null };
  else if (z.uuid().safeParse(into).success) target = { kind: "chat", projectId: into };
  else return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "That file is too big to import (4 MB at most)." }, { status: 413 });
  }
  const body = await req.text();
  if (body.length > MAX_IMPORT_BYTES) return NextResponse.json({ error: "That file is too big to import (4 MB at most)." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "That is not a JSON file from this app." }, { status: 400 });
  }
  const parsed = exportFileSchema.safeParse(json);
  if (!parsed.success) {
    const header = json as { format?: unknown; version?: unknown } | null;
    const known = header?.format === "personal-assistant-export";
    return NextResponse.json(
      { error: known && header?.version !== 1 ? "This file was made by a newer version of the app." : "That file is not a project or chat export from this app, or it was changed." },
      { status: 400 },
    );
  }

  const result = await importFile(userId, parsed.data, target);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // The lists it shows up in.
  const tags = target.kind === "projects" ? [projectsTag(userId)] : chatListTags(userId, result.projectId);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json(result);
}
