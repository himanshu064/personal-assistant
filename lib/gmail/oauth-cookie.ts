import "server-only";

/** Short lived cookie that carries the OAuth state and PKCE verifier from /connect to /callback. */
export const OAUTH_COOKIE = "gmail_oauth";
export const OAUTH_COOKIE_PATH = "/api/gmail";

export type OauthCookie = { state: string; verifier: string; userId: string };

export function encodeOauthCookie(value: OauthCookie) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeOauthCookie(raw: string | undefined): OauthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString()) as Partial<OauthCookie>;
    return value.state && value.verifier && value.userId ? (value as OauthCookie) : null;
  } catch {
    return null;
  }
}
