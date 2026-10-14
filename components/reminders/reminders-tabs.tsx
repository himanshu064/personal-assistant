"use client";

import { BellIcon, CircleCheckIcon } from "lucide-react";
import { PageTabs } from "@/components/app-shell/page-tabs";

export function RemindersTabs() {
  return (
    <PageTabs
      label="Reminder lists"
      tabs={[
        { label: "Upcoming", href: "/reminders", icon: BellIcon, match: (_p, q) => q.get("view") !== "done" },
        { label: "Done", href: "/reminders?view=done", icon: CircleCheckIcon, match: (_p, q) => q.get("view") === "done" },
      ]}
    />
  );
}
