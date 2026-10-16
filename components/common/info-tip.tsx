"use client";

import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A small (i) button that opens a short explanation. Same pattern as Facely's RevenueInfo. */
export function InfoTip({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={label}
        title={label}
      >
        <InfoIcon className="size-4" strokeWidth={1.75} />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70dvh] w-80 overflow-y-auto text-xs leading-relaxed">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
