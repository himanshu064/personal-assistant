"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";

/** Signed in visitors get "Open app"; everyone else gets Sign in and Get started. */
export function LandingNavActions() {
  const { data, isPending } = useSession();

  // Placeholder while the session check runs, so "Sign in" never flashes for signed in users.
  if (isPending) return <Skeleton className="h-10 w-28 rounded-xl" />;

  if (data?.session) {
    return (
      <Button size="page" nativeButton={false} render={<Link href="/home" />}>
        Open app
        <ArrowRightIcon strokeWidth={1.5} />
      </Button>
    );
  }
  return (
    <>
      <Button size="page" variant="ghost" nativeButton={false} className="hidden sm:inline-flex" render={<Link href="/sign-in" />}>
        Sign in
      </Button>
      <Button size="page" nativeButton={false} render={<Link href="/sign-up" />}>
        Get started
      </Button>
    </>
  );
}
