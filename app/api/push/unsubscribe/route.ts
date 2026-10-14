import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deactivateSubscription } from "@/lib/push/service";
import { getSession } from "@/lib/session";

const schema = z.object({ endpoint: z.url() });

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "endpoint is required" }, { status: 400 });

  await deactivateSubscription(parsed.data.endpoint, session.user.id);
  return NextResponse.json({ subscribed: false });
}
