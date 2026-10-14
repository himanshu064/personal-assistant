"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The URL the user just clicked, before the new page has arrived, so a nav
 * item can look active the moment it is tapped. Once the real path changes,
 * the clicked value is ignored again.
 */
export function useOptimisticPathname() {
  const pathname = usePathname();
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const href = clicked && clicked.from === pathname ? clicked.href : pathname;

  /** Pass to a Link's onClick. Ignores clicks that open a new tab or window. */
  function onNavigate(target: string) {
    return (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      setClicked({ href: target, from: pathname });
    };
  }

  return { href, onNavigate };
}
