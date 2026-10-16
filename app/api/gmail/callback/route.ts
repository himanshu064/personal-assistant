import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/gmail/client";
import { saveGmailConnection } from "@/lib/gmail/connection";
import { exchangeCode, getGoogleClient, gmailRedirectUri } from "@/lib/gmail/google-oauth";
import { decodeOauthCookie, OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/lib/gmail/oauth-cookie";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

/** Google sends the user back here after the consent screen. Saves the Gmail, then opens the Inbox. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const saved = decodeOauthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`/inbox?${query}`, req.url));
    res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return res;
  };
  const fail = (code: string) => done(`gmail_error=1&error=${encodeURIComponent(code)}`);

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in?redirect=/inbox", req.url));
  // "access_denied" when the user cancels on Google's screen.
  if (params.get("error")) return fail(params.get("error")!);
  if (!saved || saved.userId !== session.user.id || saved.state !== params.get("state")) return fail("state_mismatch");

  const code = params.get("code");
  const client = await getGoogleClient(session.user.id);
  if (!code || !client) return fail("no_client");

  try {
    const tokens = await exchangeCode(client, code, gmailRedirectUri(req.nextUrl.origin), saved.verifier);
    const { emailAddress } = await getProfile(tokens.accessToken);
    await saveGmailConnection({ userId: session.user.id, email: emailAddress, tokens });
  } catch (error) {
    console.warn("gmail.callback_failed", { message: error instanceof Error ? error.message : String(error) });
    return fail("exchange_failed");
  }
  return done("connected=1");
}
