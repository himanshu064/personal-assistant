import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isEndpointActive } from "@/lib/push/service";
import { getSession } from "@/lib/session";

const schema = z.object({ endpoint: z.url() });

/** Read only: tells the browser whether its subscription still works on our side. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });

  return NextResponse.json({ active: await isEndpointActive(parsed.data.endpoint, session.user.id) });
}
