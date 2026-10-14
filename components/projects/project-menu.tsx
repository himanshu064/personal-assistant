"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { deleteProject, updateProject } from "@/app/(app)/projects/actions";
import { safeAction } from "@/lib/safe-action";
import { ProjectForm } from "./project-form";

/** Rename or delete. Delete asks first, because it removes every chat and the memory of the project. */
export function ProjectMenu({ project }: { project: { id: string; name: string; description: string | null } }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="page" variant="outline" aria-label="Project options" />}>
          <MoreHorizontalIcon strokeWidth={1.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2Icon />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal open={renaming} onOpenChange={setRenaming} title="Rename project">
        <ProjectForm
          defaultValues={{ name: project.name, description: project.description ?? "" }}
          submitLabel="Save changes"
          onCancel={() => setRenaming(false)}
          onSubmit={async (values) => {
            const result = await safeAction(() => updateProject(project.id, values));
            if (result.ok) {
              toast.add({ title: "Project updated", type: "success" });
              setRenaming(false);
              router.refresh();
            }
            return result;
          }}
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this project?"
        description={`“${project.name}”, its chats and its memory will be deleted. This cannot be undone.`}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="page" onClick={() => setConfirming(false)} disabled={deleting}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="page"
            disabled={deleting}
            onClick={() =>
              startDelete(async () => {
                const result = await safeAction(() => deleteProject(project.id));
                if (!result.ok) return void toast.add({ title: result.error, type: "error" });
                toast.add({ title: "Project deleted", type: "success" });
                router.replace("/projects");
              })
            }
          >
            {deleting ? <Spinner /> : <Trash2Icon strokeWidth={1.5} />}
            Delete project
          </Button>
        </div>
      </ResponsiveModal>
    </>
  );
}
