"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * A centred dialog on desktop, a bottom sheet on phones (easier to reach with a thumb).
 * Layout: a fixed header (title, close), then the children, which are
 * <ModalBody> (the only part that scrolls) and an optional <ModalFooter>
 * (fixed buttons). A form can wrap both, so its submit button lives in the
 * footer: <form className={modalFormClass}><ModalBody/><ModalFooter/></form>.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[90dvh] flex-col">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle className="text-2xl font-normal tracking-tight">{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 framed ring-0 sm:max-w-md">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-2xl font-normal tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** The scrolling part. Padding is inside the scroller, so the scrollbar sits on the modal's edge. */
export function ModalBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6 md:pb-6", className)}>{children}</div>;
}

/** Buttons that stay visible while the body scrolls. Primary action last (on the right). */
export function ModalFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end md:px-6 md:py-4", className)}>
      {children}
    </div>
  );
}

/** For a form that wraps a ModalBody and a ModalFooter. */
export const modalFormClass = "flex min-h-0 flex-1 flex-col";
