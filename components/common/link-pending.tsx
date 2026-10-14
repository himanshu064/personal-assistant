"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";

/** Put inside a <Link> around its icon: swaps the icon for a spinner while the link loads. */
export function PendingIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner aria-hidden className={className} /> : <>{children}</>;
}
