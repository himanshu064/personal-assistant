"use client";

import { BrainIcon, MessagesSquareIcon } from "lucide-react";
import { PageTabs } from "@/components/app-shell/page-tabs";

export function ProjectTabs({ projectId }: { projectId: string }) {
  return (
    <PageTabs
      label="Project sections"
      tabs={[
        { label: "Chats", href: `/projects/${projectId}`, icon: MessagesSquareIcon },
        { label: "Memory", href: `/projects/${projectId}/memory`, icon: BrainIcon },
      ]}
    />
  );
}
