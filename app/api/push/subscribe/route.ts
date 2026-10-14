import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveSubscription } from "@/lib/push/service";
import { getSession } from "@/lib/session";

const schema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  await saveSubscription({
    userId: session.user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json({ subscribed: true }, { status: 201 });
}
