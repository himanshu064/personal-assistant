import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

/**
 * Reads the session once per request. The session cookie cache in
 * `lib/auth.ts` means this usually does not touch the database.
 *
 * With Cache Components on, anything that calls this must render inside a
 * <Suspense> boundary, because it reads request headers.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() }).catch(() => null);
});

/** Returns the signed in user, or sends the visitor to the sign in page. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const { id, name, email } = session.user;
  return { id, name, email };
}
