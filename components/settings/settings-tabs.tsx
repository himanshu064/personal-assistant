"use client";

import { BellIcon, KeyRoundIcon, SlidersHorizontalIcon } from "lucide-react";
import { PageTabs } from "@/components/app-shell/page-tabs";

export function SettingsTabs() {
  return (
    <PageTabs
      label="Settings"
      tabs={[
        { label: "General", href: "/settings", icon: SlidersHorizontalIcon },
        { label: "AI keys", href: "/settings/api-keys", icon: KeyRoundIcon },
        { label: "Notifications", href: "/settings/notifications", icon: BellIcon },
      ]}
    />
  );
}
