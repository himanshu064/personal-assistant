import "server-only";
import { after } from "next/server";
import { APIError } from "better-auth/api";
import { db } from "@/db";
import { gmailSync } from "@/db/schema";
import { auth } from "@/lib/auth";
import { refreshInbox } from "./refresh";
import { GmailAuthError } from "./client";
import { GMAIL_SCOPE } from "./scope";

/**
 * Runs when Google sends the user back after "Connect Gmail" (a new Gmail,
 * another one, or a reconnect). Google lets people untick "read your email" on its consent
 * screen; without that permission the connection is marked for reconnecting.
 */
export async function onGmailLinked({ userId, accountId, scope }: { userId: string; accountId: string; scope: string }) {
  const allowed = scope.split(/[\s,]+/).includes(GMAIL_SCOPE);
  const status = allowed ? ("active" as const) : ("needs_reconnect" as const);
  const problem = allowed ? null : "Gmail was connected without permission to read email. Reconnect and allow it.";

  // A new Gmail adds a row; reconnecting one carries on from its last sync
  // (no gap, nothing read twice). Other connected Gmails are left alone.
  await db
    .insert(gmailSync)
    .values({ userId, accountId, status, problem })
    .onConflictDoUpdate({ target: gmailSync.accountId, set: { status, problem } });
  refreshInbox(userId);

  if (!allowed) return;
  // First sync after the redirect, so connecting feels instant.
  const run = async () => {
    const { syncGmail } = await import("./sync");
    await syncGmail(accountId).catch((error) => console.warn("gmail.first_sync_failed", { message: String(error) }));
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
