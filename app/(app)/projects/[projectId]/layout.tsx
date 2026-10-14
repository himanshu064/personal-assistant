import { Suspense } from "react";
import { PageHeader, PageMain } from "@/components/app-shell/page";
import { ProjectMenu } from "@/components/projects/project-menu";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProject } from "@/lib/data/projects";

/** Header (name, menu, Chats and Memory tabs) streams in on its own; the tab content has its own skeleton. */
export default function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  return (
    <PageMain>
      <Suspense fallback={<HeaderSkeleton />}>
        <ProjectHeader params={params} />
      </Suspense>
      {children}
    </PageMain>
  );
}

async function ProjectHeader({ params }: { params: LayoutProps<"/projects/[projectId]">["params"] }) {
  const { projectId } = await params;
  const project = await getMyProject(projectId);
  return (
    <PageHeader
      title={project.name}
      description={project.description ?? undefined}
      breadcrumb={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
      actions={<ProjectMenu project={project} />}
      tabs={
        <Suspense fallback={<div className="h-11 border-b" />}>
          <ProjectTabs projectId={project.id} />
        </Suspense>
      }
    />
  );
}

function HeaderSkeleton() {
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-12 w-72" />
      <div className="flex gap-6 border-b pb-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  );
}
