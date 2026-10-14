import type { Metadata } from "next";
import { Suspense } from "react";
import { MemoryPanel } from "@/components/projects/memory-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectMemory } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Project memory" };

export default function ProjectMemoryPage(props: PageProps<"/projects/[projectId]/memory">) {
  return (
    <Suspense fallback={<Skeleton aria-busy aria-label="Loading" className="h-80 rounded-xl" />}>
      <Memory {...props} />
    </Suspense>
  );
}

async function Memory({ params }: PageProps<"/projects/[projectId]/memory">) {
  const { projectId } = await params;
  const { memory, updatedAt } = await getProjectMemory(projectId);
  return <MemoryPanel projectId={projectId} memory={memory} updatedAt={updatedAt} />;
}
