import type { Metadata } from "next";
import { FolderIcon } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { Page } from "@/components/app-shell/page";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Page title="Projects" description="Speak your notes, then ask questions about them.">
      <ComingSoon icon={FolderIcon} title="No projects yet" description="Projects with voice notes and chat arrive in a later update." />
    </Page>
  );
}
