import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push/service";

/** Public by design: browsers need this key to subscribe. */
export async function GET() {
  const publicKey = vapidPublicKey();
  if (!publicKey) return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
  return NextResponse.json({ publicKey });
}
