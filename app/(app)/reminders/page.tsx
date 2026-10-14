import type { Metadata } from "next";
import { BellIcon } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Reminders" };

export default function RemindersPage() {
  return (
    <PageContainer>
      <PageHeader title="Reminders" description="Everything you asked your assistant to remember." />
      <ComingSoon icon={BellIcon} title="No reminders yet" description="Creating reminders by voice or typing arrives in the next update." />
    </PageContainer>
  );
}
