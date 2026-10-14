"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SITE_NAME } from "@/lib/constants/site";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import type { CurrentUser } from "@/lib/session";

async function deactivateThisDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {
    // Signing out must never be blocked by this.
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Avatar button with the account menu. `compact` shows only the avatar. */
export function UserMenu({ user, compact = false }: { user: CurrentUser; compact?: boolean }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    // Stop this device receiving this account's reminders, so the next person
    // to use it does not see them. On their next sign in, the app's repair
    // step subscribes the device again for whoever is signed in.
    await deactivateThisDevice();
    await signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  const menu = (trigger: React.ReactElement) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} aria-label="Account menu" />
      <DropdownMenuContent align={compact ? "end" : "start"} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate text-foreground">{user.name}</span>
            <span className="truncate font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const avatar = (
    <Avatar className="size-9 rounded-lg">
      <AvatarFallback className="rounded-lg bg-primary text-xs text-primary-foreground">
        {/* Sign out takes a moment (device push is switched off first); show it. */}
        {signingOut ? <Spinner className="text-primary-foreground" aria-label="Signing out" /> : initials(user.name) || "?"}
      </AvatarFallback>
    </Avatar>
  );

  if (compact) {
    return menu(
      <button type="button" disabled={signingOut} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {avatar}
      </button>,
    );
  }

  // Sidebar account card (reference shots): avatar, name, app name, collapse button.
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.04)] group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none">
      {menu(
        <button
          type="button"
          disabled={signingOut}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {avatar}
          <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[15px]">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{signingOut ? "Signing out" : SITE_NAME}</span>
          </span>
        </button>,
      )}
      <SidebarTrigger className="text-muted-foreground group-data-[collapsible=icon]:hidden" />
    </div>
  );
}
