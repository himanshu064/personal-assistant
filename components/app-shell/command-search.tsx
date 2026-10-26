"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MicIcon, SearchIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useOpenAssistant } from "@/components/assistant/assistant-button";
import { NAV_ITEMS } from "@/lib/constants/nav";

/** Grey search field in the sidebar; opens a quick jump palette (also on Cmd/Ctrl K). */
export function CommandSearch() {
  const openAssistant = useOpenAssistant();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center gap-2 rounded-xl bg-[#e9e9e6] px-3 text-[15px] text-muted-foreground outline-none hover:bg-[#e4e4e0] focus-visible:ring-3 focus-visible:ring-ring/40 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
      >
        <SearchIcon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="flex-1 text-left group-data-[collapsible=icon]:sr-only">Search</span>
        <kbd className="text-xs group-data-[collapsible=icon]:hidden">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page or talk to your assistant">
        <Command>
          <CommandInput placeholder="Type a page name..." />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                openAssistant();
              }}
            >
              <MicIcon />
              Talk to your assistant (reminder, note or question)
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Pages">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
