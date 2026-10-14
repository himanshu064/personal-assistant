"use client";

import { useLinkStatus } from "next/link";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";

/**
 * Put inside a <Link>: shows a small spinner while that link's page is
 * loading, so a tap never feels ignored. Hidden from screen readers; the page
 * itself announces when it changes.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner aria-hidden className={cn("size-3.5 text-muted-foreground", className)} /> : null;
}

/** Put inside a <Link> around its icon: swaps the icon for a spinner while the link loads. */
export function PendingIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner aria-hidden className={className} /> : <>{children}</>;
}
