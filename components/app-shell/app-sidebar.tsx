"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NAV_ITEMS, isActive, type NavItem } from "@/lib/constants/nav";
import { CommandSearch } from "./command-search";
import { useOptimisticPathname } from "@/hooks/use-optimistic-pathname";

// Active item: a white pill with a hairline border, as in the reference shots.
const itemClass =
  "h-10 rounded-xl px-3 text-[15px] font-normal text-foreground/80 hover:bg-white/70 data-active:bg-white data-active:font-normal data-active:text-foreground data-active:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.04)] [&_svg]:size-[18px]";

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: (href: string) => React.MouseEventHandler }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive(pathname, item.href)}
        tooltip={item.label}
        className={itemClass}
        render={<Link href={item.href} onClick={onNavigate(item.href)} />}
      >
        <item.icon strokeWidth={1.5} />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Desktop navigation on the warm grey canvas: account card, search, then
 * sections. Phones use the bottom tab bar instead.
 */
export function AppSidebar({ account }: { account: ReactNode }) {
  // Highlight the clicked item at once; the top progress bar shows the page loading.
  const { href: pathname, onNavigate } = useOptimisticPathname();
  const essentials = NAV_ITEMS.filter((i) => i.href !== "/settings");
  const settings = NAV_ITEMS.filter((i) => i.href === "/settings");

  return (
    <Sidebar variant="inset" collapsible="icon" className="[&_[data-slot=sidebar-inner]]:px-1">
      <SidebarHeader className="gap-3 pt-3">
        {account}
        <CommandSearch />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="h-9 px-1 text-[15px] font-normal text-foreground">Essentials</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {essentials.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-3" />
        <SidebarGroup>
          <SidebarGroupLabel className="h-9 px-1 text-[15px] font-normal text-foreground">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {settings.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {/* Click the edge (or press Cmd/Ctrl B) to collapse or expand. */}
      <SidebarRail />
    </Sidebar>
  );
}
