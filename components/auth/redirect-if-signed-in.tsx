"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/validation/auth";

/**
 * Sends users with a real, valid session away from sign in and sign up. Done
 * here (not in proxy.ts) because only the server can tell a valid session
 * from a stale cookie.
 */
export function RedirectIfSignedIn() {
  const router = useRouter();
  const redirectTo = safeRedirect(useSearchParams().get("redirect"));
  const { data } = useSession();

  useEffect(() => {
    if (data?.session) router.replace(redirectTo);
  }, [data, redirectTo, router]);

  return null;
}
