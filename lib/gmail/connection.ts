import "server-only";
import { after } from "next/server";
import { APIError } from "better-auth/api";
import { db } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { account, emailItems, gmailSync } from "@/db/schema";
import { auth } from "@/lib/auth";
import { refreshInbox } from "./refresh";
import { GmailAuthError } from "./client";
import { GMAIL_SCOPE } from "./scope";

/**
 * Runs when Google sends the user back after "Connect Gmail" (first time or
 * reconnect). Google lets people untick "read your email" on its consent
 * screen; without that permission the connection is marked for reconnecting.
 */
export async function onGmailLinked({ userId, accountId, scope }: { userId: string; accountId: string; scope: string }) {
  const allowed = scope.split(/[\s,]+/).includes(GMAIL_SCOPE);
  const status = allowed ? ("active" as const) : ("needs_reconnect" as const);
  const problem = allowed ? null : "Gmail was connected without permission to read email. Reconnect and allow it.";

  const [existing] = await db.select({ accountId: gmailSync.accountId }).from(gmailSync).where(eq(gmailSync.userId, userId)).limit(1);
  if (!existing) {
    await db.insert(gmailSync).values({ userId, accountId, status, problem }).onConflictDoUpdate({ target: gmailSync.userId, set: { accountId, status, problem } });
  } else if (existing.accountId === accountId) {
    // Reconnecting the same Gmail: carry on from the last sync (no gap, nothing read twice).
    await db.update(gmailSync).set({ status, problem }).where(eq(gmailSync.userId, userId));
  } else {
    // A different Gmail: forget the old one completely and start a fresh first sync.
    await db
      .update(gmailSync)
      .set({ accountId, status, problem, email: null, lastSyncedAt: null, syncStartedAt: null })
      .where(eq(gmailSync.userId, userId));
    await db.delete(emailItems).where(eq(emailItems.userId, userId));
    await db.delete(account).where(and(eq(account.userId, userId), eq(account.providerId, "google"), ne(account.id, accountId)));
  }
  refreshInbox(userId);

  if (!allowed) return;
  // First sync after the redirect, so connecting feels instant.
  const run = async () => {
    const { syncGmail } = await import("./sync");
    await syncGmail(userId).catch((error) => console.warn("gmail.first_sync_failed", { message: String(error) }));
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * A fresh access token for the user's Gmail. Better Auth refreshes it with
 * the stored refresh token when needed. When Google refuses (the user removed
 * access, or the 7 day Testing mode limit passed), this throws GmailAuthError.
 */
export async function getGmailAccessToken(userId: string, accountId: string): Promise<string> {
  try {
    const result = await auth.api.getAccessToken({ body: { accountId, userId } });
    if (!result?.accessToken) throw new GmailAuthError("No access token");
    return result.accessToken;
  } catch (error) {
    // Better Auth reports a refused refresh (invalid_grant) or a missing account
    // as an API error. Anything else (a network blip) is not a reason to reconnect.
    if (error instanceof APIError) throw new GmailAuthError(error.message);
    throw error;
  }
}
