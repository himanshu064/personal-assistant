"use client";

import Link from "next/link";
import { Fragment, Suspense } from "react";
import { cn } from "cn";
import { AssistantTab } from "@/components/assistant/assistant-button";
import { NAV_ITEMS, isActive } from "@/lib/constants/nav";
import { useOptimisticPathname } from "@/hooks/use-optimistic-pathname";

/** Settings is in the account menu on phones, so the middle slot can hold the assistant. */
const TABS = NAV_ITEMS.filter((item) => item.href !== "/settings");

/**
 * Phone navigation, fixed to the bottom within thumb reach: two sections,
 * the assistant mic in the middle, two sections. The bottom padding keeps it
 * clear of the iPhone home bar.
 */
export function BottomTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden"
    >
      {/* Only the highlight reads the URL, so only it waits behind Suspense (see AppSidebar). */}
      <Suspense fallback={<Tabs pathname="" onNavigate={() => undefined} />}>
        <LiveTabs />
      </Suspense>
    </nav>
  );
}

function LiveTabs() {
  const { href, onNavigate } = useOptimisticPathname();
  return <Tabs pathname={href} onNavigate={onNavigate} />;
}

function Tabs({ pathname, onNavigate }: { pathname: string; onNavigate: (href: string) => React.MouseEventHandler | undefined }) {
  return (
    <ul className="mx-auto grid max-w-lg grid-cols-5">
      {TABS.map((item, index) => {
        const active = isActive(pathname, item.href);
        return (
          <Fragment key={item.href}>
            {index === 2 ? (
              <li>
                <AssistantTab />
              </li>
            ) : null}
            <li>
              <Link
                href={item.href}
                onClick={onNavigate(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground outline-none",
                  active && "text-primary",
                )}
              >
                {/* Active tab: a pill behind the icon, like a native tab bar. */}
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,scale] duration-150 ease-out group-focus-visible:ring-3 group-focus-visible:ring-ring/40 motion-safe:group-active:scale-[0.96]",
                    active && "bg-secondary",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
