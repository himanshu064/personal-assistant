import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Pages a signed out visitor may open, besides the landing page "/". */
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Cookie check only: no database call here. A forged or expired cookie gets
 * past this check, but every page and action validates the real session on
 * the server (`lib/session.ts`), so this only decides where to send people.
 *
 * It must NOT send cookie holders away from /sign-in: a stale cookie (signed
 * out elsewhere, expired, deleted account) would then loop between "/" (no
 * valid session, go to sign in) and "/sign-in" (has a cookie, go home).
 * Signed in users are moved off the auth pages by RedirectIfSignedIn instead,
 * which checks the real session.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && pathname !== "/" && !matches(pathname, PUBLIC_PATHS)) {
    const signIn = new URL("/sign-in", request.url);
    if (pathname !== "/home") signIn.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip API routes (they check auth themselves), Next internals, the PWA
    // files and static images.
    "/((?!api/|_next/static|_next/image|manifest.webmanifest|sw.js|icon.png|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
