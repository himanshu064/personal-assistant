import "server-only";
import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

/**
 * Web push, ported from email-automation's pushService. Payloads are
 * encrypted with each subscription's own keys, so the push service (Google,
 * Apple, Mozilla) only relays ciphertext.
 */

let configured = false;

/** Returns false when VAPID keys are missing, so callers can skip quietly. */
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", publicKey, privateKey);
  configured = true;
  return true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function saveSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}) {
  const values = { ...input, isActive: true };
  // One round trip. The same device subscribing again (or a new user signing
  // in on it) takes over the row.
  await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
}

export async function deactivateSubscription(endpoint: string, userId: string) {
  await db
    .update(pushSubscriptions)
    .set({ isActive: false })
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

/**
 * Whether we would still push to this endpoint. A dead endpoint is only ever
 * found on our side (a 404 or 410 when sending), and nothing tells the
 * browser, so the app asks on open and subscribes again if needed.
 */
export async function isEndpointActive(endpoint: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isActive: pushSubscriptions.isActive })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
    .limit(1);
  return row?.isActive ?? false;
}

export type PushPayload = {
  type: "reminder";
  title: string;
  body: string;
  /** Same tag replaces an earlier notification instead of stacking a new one. */
  tag: string;
  /** Page to open when the notification is tapped. */
  url: string;
};

/**
 * Sends to every active device of a user and returns how many received it.
 * Never throws: one failed device must not stop the others, or the cron.
 */
export async function pushToUser(userId: string, payload: PushPayload, ttlSeconds: number): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await db
    .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));

  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { urgency: "normal", TTL: ttlSeconds },
        );
        return true;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // The browser threw this subscription away; stop sending to it.
          await db.update(pushSubscriptions).set({ isActive: false }).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error("[push] send failed", {
            status,
            endpointHost: new URL(sub.endpoint).host,
            message: (error as Error)?.message,
          });
        }
        return false;
      }
    }),
  );

  return results.filter(Boolean).length;
}
