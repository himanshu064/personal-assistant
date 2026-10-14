"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { useOptimisticPathname } from "@/hooks/use-optimistic-pathname";

export type PageTab = {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Marks this tab active. Defaults to an exact path match. */
  match?: (pathname: string, params: URLSearchParams) => boolean;
};

/** Underline tabs with icons, under the page title (reference shots). */
export function PageTabs({ tabs, label }: { tabs: PageTab[]; label: string }) {
  const params = useSearchParams();
  // Mark the clicked tab active at once, including its query (for example ?status=done).
  const { href: clickedHref, onNavigate } = useOptimisticPathname();
  const clicked = new URL(clickedHref, "http://x");
  const pathname = clicked.pathname;
  const current = clickedHref.includes("?") ? clicked.searchParams : new URLSearchParams(params.toString());

  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex gap-6">
        {tabs.map((tab) => {
          const active = tab.match ? tab.match(pathname, current) : pathname === tab.href;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                onClick={onNavigate(tab.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 border-transparent py-2.5 text-[15px] text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground",
                  active && "border-foreground text-foreground",
                )}
              >
                {tab.icon ? <tab.icon className="size-4" strokeWidth={1.5} aria-hidden /> : null}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
