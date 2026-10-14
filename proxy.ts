import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Pages a signed out visitor may open. */
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"];

/** Pages a signed in user has no reason to see. */
const SIGNED_OUT_ONLY_PATHS = ["/sign-in", "/sign-up"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Cookie check only: no database call here. A forged or expired cookie gets
 * past this check, but every page and action validates the real session on
 * the server (`lib/session.ts`), so this only decides where to send people.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !matches(pathname, PUBLIC_PATHS)) {
    const signIn = new URL("/sign-in", request.url);
    if (pathname !== "/") signIn.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  // Server actions and RSC refetches from auth pages must pass through;
  // only full page loads are redirected.
  const isInternal = request.headers.has("next-action") || request.headers.get("rsc") === "1";
  if (hasSession && !isInternal && matches(pathname, SIGNED_OUT_ONLY_PATHS)) {
    return NextResponse.redirect(new URL("/", request.url));
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
