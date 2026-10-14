import type { Metadata } from "next";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { SettingsSection } from "@/components/settings/settings-section";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsSettingsPage() {
  return (
    <SettingsSection title="Notifications" description="Each device has its own setting. Turn it on everywhere you want reminders.">
      <NotificationsCard />
    </SettingsSection>
  );
}
