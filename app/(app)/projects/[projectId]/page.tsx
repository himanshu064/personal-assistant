import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectChat } from "@/components/projects/project-chat";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProjects, getProjectMemory, getProjectThreads, getThreadMessages } from "@/lib/data/projects";
import { getMySettings } from "@/lib/data/settings";
import type { ProjectChatMessage } from "@/lib/projects/chat-types";

export const metadata: Metadata = { title: "Project chats" };

export default function ProjectChatPage(props: PageProps<"/projects/[projectId]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <Chat {...props} />
    </Suspense>
  );
}

async function Chat({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);
  const threadId = typeof sp.thread === "string" ? sp.thread : null;

  // Independent reads in parallel.
  const [threads, messages, settings, memory, projects] = await Promise.all([
    getProjectThreads(projectId),
    threadId ? getThreadMessages(projectId, threadId) : Promise.resolve([]),
    getMySettings(),
    getProjectMemory(projectId),
    getMyProjects(),
  ]);
  const validThread = threadId && threads.some((t) => t.id === threadId) ? threadId : null;

  return (
    <ProjectChat
      // A different chat from the URL starts a fresh chat state.
      key={validThread ?? "new"}
      projectId={projectId}
      threads={threads}
      threadId={validThread}
      initialMessages={validThread ? (messages as ProjectChatMessage[]) : []}
      hasKey={Boolean(settings.keys[settings.provider])}
      hasMemory={memory.memory.length > 0}
      moveTargets={projects.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}

function ChatSkeleton() {
  return (
    <div aria-busy aria-label="Loading" className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Skeleton className="hidden h-64 rounded-xl lg:block" />
      <div className="flex min-h-[32rem] flex-col gap-4 rounded-xl bg-card p-6 framed">
        <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
