import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleOauthClients } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * Each user connects Gmail through their own Google OAuth client (from their
 * Google Cloud project). These are the few OAuth calls that needs, with plain
 * fetch: build the consent URL, swap the code for tokens, refresh, and test
 * a client without anyone signing in.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleClient = { clientId: string; clientSecret: string };

/** Where Google sends the user back. Must be listed in the Google client's "Authorized redirect URIs". */
export function gmailRedirectUri(origin: string) {
  return `${origin}/api/gmail/callback`;
}

/** This site's origin as the browser sees it (the same value the connect route reads from the request URL). */
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export async function getGoogleClient(userId: string): Promise<GoogleClient | null> {
  const [row] = await db
    .select({ clientId: googleOauthClients.clientId, encryptedSecret: googleOauthClients.encryptedSecret })
    .from(googleOauthClients)
    .where(eq(googleOauthClients.userId, userId))
    .limit(1);
  return row ? { clientId: row.clientId, clientSecret: decrypt(row.encryptedSecret) } : null;
}

type TokenResponse = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; error?: string; error_description?: string };

async function postToken(body: Record<string, string>): Promise<{ status: number; data: TokenResponse }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as TokenResponse };
}

/**
 * Checks a Client ID and secret without anyone signing in: a made up code is
 * sent to Google's token endpoint. Google answers "invalid_client" when the ID
 * or secret is wrong and "invalid_grant" (bad code) when both are right.
 * It cannot check the redirect URI; Google shows that error on its own screen.
 */
export async function testGoogleClient(client: GoogleClient, redirectUri: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { data } = await postToken({
      grant_type: "authorization_code",
      code: "connection-test",
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri,
    });
    if (data.error === "invalid_grant") return { ok: true };
    if (data.error === "invalid_client") {
      return {
        ok: false,
        message: /not found/i.test(data.error_description ?? "")
          ? "Google does not know this Client ID. Copy it again from Google Cloud > Credentials."
          : "The Client secret does not match this Client ID. Copy it again, or create a new secret.",
      };
    }
    console.warn("google.client_test_unexpected", { error: data.error });
    return { ok: false, message: "Google gave an unexpected answer. Check both values and try again." };
  } catch {
    return { ok: false, message: "We could not reach Google to check this. Try again in a moment." };
  }
}

/** The consent screen URL: read only Gmail, a refresh token, and the account picker so another Gmail can be chosen. */
export function consentUrl(client: GoogleClient, opts: { redirectUri: string; state: string; codeChallenge: string; scope: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", opts.scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account consent");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export type Tokens = { accessToken: string; expiresAt: Date; refreshToken: string | null; scope: string };

function toTokens(data: TokenResponse): Tokens {
  return {
    accessToken: data.access_token!,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    refreshToken: data.refresh_token ?? null,
    scope: data.scope ?? "",
  };
}

/** Swaps the code Google sent back for tokens. Throws with Google's error code. */
export async function exchangeCode(client: GoogleClient, code: string, redirectUri: string, codeVerifier: string): Promise<Tokens> {
  const { data } = await postToken({
    grant_type: "authorization_code",
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  if (!data.access_token) throw new Error(data.error ?? "exchange_failed");
  return toTokens(data);
}

/**
 * A fresh access token from the refresh token. `revoked` means Google will
 * not refresh any more (access removed, the 7 day Testing mode limit, or a
 * changed or deleted Google client), so Gmail must be reconnected.
 */
export async function refreshAccessToken(client: GoogleClient, refreshToken: string): Promise<Tokens | { revoked: true }> {
  const { status, data } = await postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
  });
  if (data.access_token) return toTokens(data);
  if (data.error === "invalid_grant" || data.error === "invalid_client" || data.error === "unauthorized_client") return { revoked: true };
  throw new Error(`Google token refresh failed: ${status} ${data.error ?? ""}`);
}
