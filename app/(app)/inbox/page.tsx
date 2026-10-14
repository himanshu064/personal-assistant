import type { Metadata } from "next";
import { InboxIcon } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { Page } from "@/components/app-shell/page";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <Page title="Inbox" description="Meetings and reminders found in your Gmail.">
      <ComingSoon icon={InboxIcon} title="Gmail is not connected yet" description="Connecting Gmail arrives in a later update." />
    </Page>
  );
}
