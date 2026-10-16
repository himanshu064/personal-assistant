import type { Metadata } from "next";
import { Suspense } from "react";
import { Page } from "@/components/app-shell/page";
import { ProjectChat } from "@/components/projects/project-chat";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyQuickThreads, getQuickThreadMessages } from "@/lib/data/chats";
import { getMyProjects } from "@/lib/data/projects";
import { getMySettings } from "@/lib/data/settings";
import type { ProjectChatMessage } from "@/lib/projects/chat-types";

export const metadata: Metadata = { title: "Chat" };

/** Quick chats: a general assistant, not tied to a project. Same chat screen as projects. */
export default function ChatPage(props: PageProps<"/chat">) {
  return (
    <Page title="Chat" description="Quick chats with your assistant. Move one into a project any time.">
      <Suspense fallback={<ChatSkeleton />}>
        <QuickChat searchParams={props.searchParams} />
      </Suspense>
    </Page>
  );
}

async function QuickChat({ searchParams }: { searchParams: PageProps<"/chat">["searchParams"] }) {
  const sp = await searchParams;
  const threadId = typeof sp.thread === "string" ? sp.thread : null;

  // Independent reads in parallel.
  const [threads, messages, settings, projects] = await Promise.all([
    getMyQuickThreads(),
    threadId ? getQuickThreadMessages(threadId) : Promise.resolve([]),
    getMySettings(),
    getMyProjects(),
  ]);
  const validThread = threadId && threads.some((t) => t.id === threadId) ? threadId : null;

  return (
    <ProjectChat
      // A different chat from the URL starts a fresh chat state.
      key={validThread ?? "new"}
      projectId={null}
      threads={threads}
      threadId={validThread}
      initialMessages={validThread ? (messages as ProjectChatMessage[]) : []}
      hasKey={Boolean(settings.keys[settings.provider])}
      hasMemory={false}
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
        <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
