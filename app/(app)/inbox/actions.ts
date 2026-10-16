"use server";

import { updateTag } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { emailItems, gmailSync } from "@/db/schema";
import { inboxTag } from "@/lib/data/inbox-tags";
import { getGmailAccessToken } from "@/lib/gmail/connection";
import { syncGmail } from "@/lib/gmail/sync";
import { requireUser } from "@/lib/session";

type Fail = { ok: false; error: string };

/** "Sync now": reads new mail in every connected Gmail straight away instead of waiting for the next 30 minute run. */
export async function syncNow(): Promise<{ ok: true; message: string } | Fail> {
  const user = await requireUser();
  const connections = await db.select({ accountId: gmailSync.accountId }).from(gmailSync).where(eq(gmailSync.userId, user.id));
  const results = await Promise.all(connections.map((c) => syncGmail(c.accountId)));
  updateTag(inboxTag(user.id));

  const done = results.filter((r) => r.ok);
  if (done.length > 0) {
    const suggested = done.reduce((sum, r) => sum + r.suggested, 0);
    return {
      ok: true,
      message:
        suggested > 0
          ? `Found ${suggested} new ${suggested === 1 ? "suggestion" : "suggestions"}.`
          : "You are up to date. Nothing new to suggest.",
    };
  }
  const errors = {
    busy: "A sync is already running. Results appear in a moment.",
    not_connected: "Connect Gmail first.",
    reconnect: "Gmail needs to be reconnected.",
    error: "Gmail could not be read just now. Try again in a minute.",
  } as const;
  const failed = results.find((r) => !r.ok);
  return { ok: false, error: errors[failed && !failed.ok ? failed.reason : "not_connected"] };
}

/** Dismiss a suggestion, or bring a dismissed one back. Added ones stay added. */
export async function setSuggestionStatus(id: unknown, status: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const itemId = z.uuid().safeParse(id);
  const next = z.enum(["new", "dismissed"]).safeParse(status);
  if (!itemId.success || !next.success) return { ok: false, error: "Something went wrong. Try again." };

  const updated = await db
    .update(emailItems)
    .set({ status: next.data })
    .where(and(eq(emailItems.id, itemId.data), eq(emailItems.userId, user.id), inArray(emailItems.status, ["new", "dismissed"])))
    .returning({ id: emailItems.id });
  if (updated.length === 0) return { ok: false, error: "This suggestion no longer exists." };
  updateTag(inboxTag(user.id));
  return { ok: true };
}

/**
 * Disconnects one Gmail: asks Google to revoke access, then deletes its row
 * (tokens included). Its suggestions go with it (foreign key cascade). Other
 * Gmails and reminders already made stay.
 */
export async function disconnectGmail(accountId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const id = z.uuid().safeParse(accountId);
  if (!id.success) return { ok: false, error: "Something went wrong. Try again." };

  const [connection] = await db
    .select({ accountId: gmailSync.accountId })
    .from(gmailSync)
    .where(and(eq(gmailSync.accountId, id.data), eq(gmailSync.userId, user.id)))
    .limit(1);
  if (!connection) return { ok: false, error: "This Gmail is not connected." };

  // Best effort: if the token already expired, Google has nothing to revoke.
  try {
    const token = await getGmailAccessToken(user.id, connection.accountId);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch (error) {
    console.warn("gmail.revoke_failed", { message: error instanceof Error ? error.message : String(error) });
  }

  await db.delete(gmailSync).where(and(eq(gmailSync.accountId, connection.accountId), eq(gmailSync.userId, user.id)));
  updateTag(inboxTag(user.id));
  return { ok: true };
}
