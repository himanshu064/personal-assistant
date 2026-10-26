import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessagesSquareIcon, FolderIcon } from "lucide-react";
import { Page } from "@/components/app-shell/page";
import { EmptyState } from "@/components/common/empty-state";
import { ImportButton } from "@/components/projects/import-file";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProjects } from "@/lib/data/projects";
import { formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Page
      title="Projects"
      description="Tell the assistant about each project, then ask it anything later."
      actions={
        <div className="flex flex-wrap gap-2">
          <ImportButton into="projects" label="Import project" />
          <NewProjectButton />
        </div>
      }
    >
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsGrid />
      </Suspense>
    </Page>
  );
}

async function ProjectsGrid() {
  const projects = await getMyProjects();
  if (projects.length === 0) {
    return (
      <div className="rounded-xl bg-card framed">
        <EmptyState
          icon={FolderIcon}
          title="No projects yet"
          description="A project keeps everything you say about one topic, so you can ask about it later."
          action={<NewProjectButton />}
        />
      </div>
    );
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}`}
            className="flex h-full flex-col gap-4 rounded-2xl bg-card p-5 outline-none framed transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
                <FolderIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="truncate text-lg tracking-tight">{p.name}</h2>
                <p className="line-clamp-2 text-sm text-muted-foreground">{p.description || "No description"}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-dashed pt-3 text-sm text-muted-foreground">
              <Badge variant="neutral" className="gap-1">
                <MessagesSquareIcon aria-hidden />
                {p.chatCount} {p.chatCount === 1 ? "chat" : "chats"}
              </Badge>
              <span>Updated {formatRelative(new Date(p.updatedAt))}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProjectsSkeleton() {
  return (
    <ul aria-busy aria-label="Loading" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex flex-col gap-4 rounded-2xl bg-card p-5 framed">
          <div className="flex gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
            </div>
          </div>
          <Skeleton className="h-5 w-full" />
        </li>
      ))}
    </ul>
  );
}
