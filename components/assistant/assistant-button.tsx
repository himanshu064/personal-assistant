"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MicIcon } from "lucide-react";
import { cn } from "cn";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Assistant } from "./assistant";

const OpenAssistant = createContext<() => void>(() => {});

/** Opens the assistant (listening), from anywhere inside AssistantProvider. */
export function useOpenAssistant() {
  return useContext(OpenAssistant);
}

/** The one assistant sheet, opened by the phone tab or the desktop button. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // A fresh assistant (listening again) every time it opens.
  const [session, setSession] = useState(0);

  return (
    <OpenAssistant.Provider
      value={() => {
        setSession((n) => n + 1);
        setOpen(true);
      }}
    >
      {children}
      <ResponsiveModal open={open} onOpenChange={setOpen} title="Assistant" fullScreen hideTitle>
        <Assistant key={session} onDone={() => setOpen(false)} />
      </ResponsiveModal>
    </OpenAssistant.Provider>
  );
}

const orb =
  "flex items-center justify-center rounded-full bg-primary text-primary-foreground outline-none " +
  "shadow-[0_12px_32px_-10px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.15)] " +
  "transition-[scale] duration-150 ease-out motion-safe:active:scale-[0.96] focus-visible:ring-4 focus-visible:ring-ring/40";

/** Desktop: floating, bottom right. Phones use the tab bar's middle button instead. */
export function AssistantFab() {
  const open = useContext(OpenAssistant);
  return (
    <button type="button" onClick={open} aria-label="Talk to your assistant" className={cn(orb, "fixed right-6 bottom-6 z-40 hidden size-14 md:flex")}>
      <MicIcon className="size-6" strokeWidth={1.75} />
    </button>
  );
}

/** Phones: the raised middle button of the bottom tab bar. */
export function AssistantTab() {
  const open = useContext(OpenAssistant);
  return (
    <div className="flex h-16 items-center justify-center">
      <button type="button" onClick={open} aria-label="Talk to your assistant" className={cn(orb, "-mt-5 size-14")}>
        <MicIcon className="size-6" strokeWidth={1.75} />
      </button>
    </div>
  );
}
