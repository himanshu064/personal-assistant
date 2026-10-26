"use client";

import { useState } from "react";
import { BellPlusIcon } from "lucide-react";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { NewReminder } from "./new-reminder";

export function NewReminderButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="page" onClick={() => setOpen(true)}>
        <BellPlusIcon strokeWidth={1.5} />
        New reminder
      </Button>
      <ResponsiveModal open={open} onOpenChange={setOpen} title="New reminder" fullScreen>
        <NewReminder onSaved={() => setOpen(false)} />
      </ResponsiveModal>
    </>
  );
}
