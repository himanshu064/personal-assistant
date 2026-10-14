"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { withSearchParams } from "@/lib/url";
import { PendingIcon } from "@/components/common/link-pending";

/** Page links driven by `?page=`. Hidden when everything fits on one page. */
export function Pagination({
  currentPage,
  pageSize,
  totalCount,
  paramName = "page",
}: {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  paramName?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(page: number) {
    const qs = withSearchParams(searchParams, { [paramName]: page === 1 ? null : page });
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  const disabled = "pointer-events-none opacity-50";

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <span className="text-xs text-muted-foreground">
        Page {currentPage} of {totalPages}, {totalCount.toLocaleString("en-US")} total
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={currentPage > 1 ? hrefFor(currentPage - 1) : "#"}
          aria-disabled={currentPage <= 1}
          aria-label="Previous page"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), currentPage <= 1 && disabled)}
        >
          <PendingIcon>
            <ChevronLeftIcon />
          </PendingIcon>
        </Link>
        {/* Page numbers take too much room on phones; arrows are enough there. */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers(currentPage, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-2 text-sm text-muted-foreground" aria-hidden>
                ...
              </span>
            ) : (
              <Link
                key={p}
                href={hrefFor(p)}
                aria-current={p === currentPage ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: p === currentPage ? "default" : "outline", size: "sm" }),
                  "min-w-8",
                  p === currentPage && "pointer-events-none",
                )}
              >
                <PendingIcon>{p}</PendingIcon>
              </Link>
            ),
          )}
        </div>
        <Link
          href={currentPage < totalPages ? hrefFor(currentPage + 1) : "#"}
          aria-disabled={currentPage >= totalPages}
          aria-label="Next page"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), currentPage >= totalPages && disabled)}
        >
          <PendingIcon>
            <ChevronRightIcon />
          </PendingIcon>
        </Link>
      </div>
    </nav>
  );
}

function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "gap")[] = [1];
  if (current > 3) pages.push("gap");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("gap");
  pages.push(total);
  return pages;
}
