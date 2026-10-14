"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BellIcon, BellOffIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * Phones only. On desktop the reference has no top bar: each page starts with
 * its breadcrumb and title, and the sidebar holds the account card.
 */
export function SiteHeader({ userMenu }: { userMenu: ReactNode }) {
  const push = usePushNotifications();
  const pushOn = push.isSubscribed;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur md:hidden">
      <Logo />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          aria-label={pushOn ? "Notifications are on" : "Notifications are off"}
          render={<Link href="/settings/notifications" />}
        >
          {pushOn ? <BellIcon strokeWidth={1.5} /> : <BellOffIcon strokeWidth={1.5} className="text-muted-foreground" />}
        </Button>
        {userMenu}
      </div>
    </header>
  );
}
