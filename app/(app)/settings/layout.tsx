import { Suspense } from "react";
import { Page } from "@/components/app-shell/page";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <Page
      title="Settings"
      description="Manage your preferences, AI keys and notifications."
      tabs={
        <Suspense fallback={<div className="h-11 border-b" />}>
          <SettingsTabs />
        </Suspense>
      }
    >
      <div className="flex max-w-2xl flex-col gap-6">{children}</div>
    </Page>
  );
}
