"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PanelLeftOpenIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_ITEMS, isActive, type NavItem } from "@/lib/constants/nav";
import { CommandSearch } from "./command-search";
import { useOptimisticPathname } from "@/hooks/use-optimistic-pathname";

// Active item: a white pill with a hairline border, as in the reference shots.
const itemClass =
  "h-10 rounded-xl px-3 text-[15px] font-normal text-foreground/80 hover:bg-white/70 data-active:bg-white data-active:font-normal data-active:text-foreground data-active:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.04)] [&_svg]:size-[18px]";

type OnNavigate = (href: string) => React.MouseEventHandler | undefined;

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: OnNavigate }) {
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

const noHighlight: OnNavigate = () => undefined;

/** The links of one section; pathname "" shows none as active. */
function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: OnNavigate }) {
  return items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />);
}

/** Reads the URL to highlight the current page (and the clicked one at once; the top progress bar shows loading). */
function LiveNavLinks({ items }: { items: NavItem[] }) {
  const { href, onNavigate } = useOptimisticPathname();
  return <NavLinks items={items} pathname={href} onNavigate={onNavigate} />;
}

/**
 * Only the highlight depends on the URL, so only that part waits behind
 * Suspense: pages with a dynamic segment (/projects/[projectId]) can still be
 * prerendered, with the same links shown un-highlighted until it streams in.
 */
function SectionLinks({ items }: { items: NavItem[] }) {
  return (
    <Suspense fallback={<NavLinks items={items} pathname="" onNavigate={noHighlight} />}>
      <LiveNavLinks items={items} />
    </Suspense>
  );
}

/**
 * At the bottom, only while collapsed: the collapse button next to the name
 * is hidden then, so this is the way back to the full sidebar.
 */
function ExpandButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <SidebarFooter className="hidden pb-3 group-data-[collapsible=icon]:flex">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Expand sidebar" aria-label="Expand sidebar" className={itemClass} onClick={toggleSidebar}>
            <PanelLeftOpenIcon strokeWidth={1.5} />
            <span>Expand sidebar</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

/**
 * Desktop navigation on the warm grey canvas: account card, search, then
 * sections. Phones use the bottom tab bar instead.
 */
export function AppSidebar({ account }: { account: ReactNode }) {
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
              <SectionLinks items={essentials} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-3" />
        <SidebarGroup>
          <SidebarGroupLabel className="h-9 px-1 text-[15px] font-normal text-foreground">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SectionLinks items={settings} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <ExpandButton />
      {/* Click the edge (or press Cmd/Ctrl B) to collapse or expand. */}
      <SidebarRail />
    </Sidebar>
  );
}
