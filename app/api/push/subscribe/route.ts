import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveSubscription } from "@/lib/push/service";
import { getSession } from "@/lib/session";

/**
 * The server later POSTs to the endpoint, so only the browser push services
 * are accepted (https, known hosts). Otherwise anyone could make the server
 * send requests to an address of their choice.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

function isPushServiceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

const schema = z.object({
  endpoint: z.url().max(1000).refine(isPushServiceUrl, "Not a browser push service"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
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
