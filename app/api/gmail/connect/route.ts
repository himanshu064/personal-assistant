import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { consentUrl, getGoogleClient, gmailRedirectUri } from "@/lib/gmail/google-oauth";
import { encodeOauthCookie, OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/lib/gmail/oauth-cookie";
import { GMAIL_SCOPE } from "@/lib/gmail/scope";
import { getSession } from "@/lib/session";

/**
 * "Connect Gmail": sends the user to Google's consent screen with their own
 * Google client. `state` stops forged callbacks; PKCE stops a stolen code
 * from being used anywhere else.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in?redirect=/inbox", req.url));

  const client = await getGoogleClient(session.user.id);
  if (!client) return NextResponse.redirect(new URL("/settings/google?missing=1", req.url));

  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");

  const res = NextResponse.redirect(
    consentUrl(client, { redirectUri: gmailRedirectUri(req.nextUrl.origin), state, codeChallenge, scope: GMAIL_SCOPE }),
  );
  res.cookies.set(OAUTH_COOKIE, encodeOauthCookie({ state, verifier, userId: session.user.id }), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60,
  });
  return res;
}
