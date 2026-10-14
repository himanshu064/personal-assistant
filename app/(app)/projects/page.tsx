import type { Metadata } from "next";
import { FolderIcon } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <PageContainer>
      <PageHeader title="Projects" description="Speak your notes, then ask questions about them." />
      <ComingSoon icon={FolderIcon} title="No projects yet" description="Projects with voice notes and chat arrive in a later update." />
    </PageContainer>
  );
}
