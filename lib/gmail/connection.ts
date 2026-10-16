import "server-only";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { gmailSync, googleOauthClients } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { refreshInbox } from "./refresh";
import { GmailAuthError } from "./client";
import { refreshAccessToken, type Tokens } from "./google-oauth";
import { GMAIL_SCOPE } from "./scope";

/** An access token this close to expiry is refreshed first. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Saves a Gmail after Google sends the user back from "Connect Gmail" (a new
 * Gmail, another one, or a reconnect). The same address updates its row, so
 * a reconnect carries on from its last sync (no gap, nothing read twice).
 * Google lets people untick "read your email" on its consent screen; without
 * that permission the connection is marked for reconnecting.
 */
export async function saveGmailConnection({ userId, email, tokens }: { userId: string; email: string; tokens: Tokens }) {
  const allowed = tokens.scope.split(/\s+/).includes(GMAIL_SCOPE);
  const status = allowed ? ("active" as const) : ("needs_reconnect" as const);
  const problem = allowed ? null : "Gmail was connected without permission to read email. Reconnect and allow it.";
  const values = {
    encryptedAccessToken: encrypt(tokens.accessToken),
    accessTokenExpiresAt: tokens.expiresAt,
    // Google sends a refresh token with every consent (prompt=consent); keep the old one if it ever does not.
    encryptedRefreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    status,
    problem,
  };

  const [row] = await db
    .insert(gmailSync)
    .values({ userId, email, ...values })
    .onConflictDoUpdate({
      target: [gmailSync.userId, gmailSync.email],
      targetWhere: sql`${gmailSync.email} is not null`,
      set: { ...values, encryptedRefreshToken: sql`coalesce(excluded.encrypted_refresh_token, ${gmailSync.encryptedRefreshToken})` },
    })
    .returning({ accountId: gmailSync.accountId });
  refreshInbox(userId);
  if (!allowed) return;

  // First sync after the redirect, so connecting feels instant.
  const run = async () => {
    const { syncGmail } = await import("./sync");
    await syncGmail(row.accountId).catch((error) => console.warn("gmail.first_sync_failed", { message: String(error) }));
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * A fresh access token for one connected Gmail, refreshed with the user's
 * own Google client when it is about to expire. When Google refuses (access
 * removed, the 7 day Testing mode limit, or the Google client was changed or
 * removed), this throws GmailAuthError so the Inbox asks to reconnect.
 */
export async function getGmailAccessToken(userId: string, accountId: string): Promise<string> {
  const [row] = await db
    .select({
      encryptedRefreshToken: gmailSync.encryptedRefreshToken,
      encryptedAccessToken: gmailSync.encryptedAccessToken,
      accessTokenExpiresAt: gmailSync.accessTokenExpiresAt,
      clientId: googleOauthClients.clientId,
      encryptedSecret: googleOauthClients.encryptedSecret,
    })
    .from(gmailSync)
    .leftJoin(googleOauthClients, eq(googleOauthClients.userId, gmailSync.userId))
    .where(and(eq(gmailSync.accountId, accountId), eq(gmailSync.userId, userId)))
    .limit(1);

  if (!row?.encryptedRefreshToken || !row.clientId || !row.encryptedSecret) throw new GmailAuthError("Not connected");
  if (row.encryptedAccessToken && row.accessTokenExpiresAt && row.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) {
    return decrypt(row.encryptedAccessToken);
  }

  const result = await refreshAccessToken({ clientId: row.clientId, clientSecret: decrypt(row.encryptedSecret) }, decrypt(row.encryptedRefreshToken));
  if ("revoked" in result) throw new GmailAuthError("Google refused to refresh");
  await db
    .update(gmailSync)
    .set({
      encryptedAccessToken: encrypt(result.accessToken),
      accessTokenExpiresAt: result.expiresAt,
      ...(result.refreshToken ? { encryptedRefreshToken: encrypt(result.refreshToken) } : {}),
    })
    .where(eq(gmailSync.accountId, accountId));
  return result.accessToken;
}
