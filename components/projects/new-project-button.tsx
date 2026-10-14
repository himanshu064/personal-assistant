"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlusIcon } from "lucide-react";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createProject } from "@/app/(app)/projects/actions";
import { safeAction } from "@/lib/safe-action";
import { ProjectForm } from "./project-form";

export function NewProjectButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="page" variant={variant} onClick={() => setOpen(true)}>
        <FolderPlusIcon strokeWidth={1.5} />
        New project
      </Button>
      <ResponsiveModal open={open} onOpenChange={setOpen} title="New project" description="A project keeps its chats and what the assistant remembers.">
        <ProjectForm
          submitLabel="Create project"
          onCancel={() => setOpen(false)}
          onSubmit={async (values) => {
            const result = await safeAction(() => createProject(values));
            if (result.ok) {
              toast.add({ title: "Project created", type: "success" });
              setOpen(false);
              router.push(`/projects/${result.id}`);
            }
            return result;
          }}
        />
      </ResponsiveModal>
    </>
  );
}
