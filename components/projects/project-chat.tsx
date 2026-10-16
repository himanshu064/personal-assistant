"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpIcon, KeyRoundIcon, MessageSquarePlusIcon, MessagesSquareIcon, RotateCwIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { deleteThread } from "@/app/(app)/projects/actions";
import { HANDOFF_EVENT, takeHandOff } from "@/lib/assistant/handoff";
import type { ThreadRow } from "@/lib/data/projects";
import { MAX_MESSAGE_CHARS, type ProjectChatMessage } from "@/lib/projects/chat-types";
import { safeAction } from "@/lib/safe-action";
import { formatRelative } from "@/lib/time";
import { ChatMessage } from "./chat-message";

/**
 * A new chat's id, made in the browser so every request of the chat carries it.
 * crypto.randomUUID only exists on https and localhost; a phone opening the
 * dev server by its LAN address gets the getRandomValues version.
 */
function newChatId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const SUGGESTIONS = ["Summarise this project", "What is still open or pending?", "Who owes whom, and how much?"];

export function ProjectChat({
  projectId,
  threads: initialThreads,
  threadId,
  initialMessages,
  hasKey,
  hasMemory,
}: {
  projectId: string;
  threads: ThreadRow[];
  threadId: string | null;
  initialMessages: ProjectChatMessage[];
  hasKey: boolean;
  /** The project already remembers something, so questions make sense in a new chat. */
  hasMemory: boolean;
}) {
  const router = useRouter();
  const base = `/projects/${projectId}`;
  // The chat being shown. Saved chats come from the URL; a new one gets a fresh id.
  const [firstId] = useState(() => threadId ?? newChatId());
  const threadRef = useRef<string>(firstId);
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(threadId);
  const [input, setInput] = useState("");
  const [deleting, startDelete] = useTransition();
  /** The chat waiting for "Delete this chat?" to be confirmed. */
  const [confirmDelete, setConfirmDelete] = useState<ThreadRow | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ProjectChatMessage>({
        api: `/api/projects/${projectId}/chat`,
        // Only the newest message travels (plus the thread id passed with each send);
        // the server loads the recent history and the project memory itself.
        prepareSendMessagesRequest: ({ messages, body, trigger }) => ({ body: { ...body, trigger, message: messages[messages.length - 1] } }),
      }),
    [projectId],
  );

  const { messages, sendMessage, status, error, stop, regenerate, setMessages, clearError } = useChat<ProjectChatMessage>({
    id: firstId,
    messages: initialMessages,
    transport,
    onFinish: ({ message, messages: all, isError }) => {
      const id = message.metadata?.threadId;
      // The server saves a chat with its first answer; nothing is saved on an error.
      const answered = message.parts.some((p) => p.type === "text" && p.text.trim());
      if (!id || isError || !answered || id !== threadRef.current) return;
      // Show the chat in the URL and the list without a reload (new on its first answer).
      setActiveId(id);
      window.history.replaceState(null, "", `${base}?thread=${id}`);
      const first = all.find((m) => m.role === "user");
      const text = first?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
      const title = text.length > 60 ? `${text.slice(0, 57)}...` : text || "New chat";
      setThreads((list) =>
        list.some((t) => t.id === id)
          ? list.map((t) => (t.id === id ? { ...t, updatedAt: new Date() } : t))
          : [{ id, title, updatedAt: new Date() }, ...list],
      );
    },
  });

  const busy = status === "submitted" || status === "streaming";

  // Keep the newest message in view while the answer streams in.
  useEffect(() => {
    // Instant while words stream in (smooth scrolling every word looks jumpy).
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [messages, status]);

  function send(text: string) {
    const question = text.trim();
    if (!question) return;
    // Mid answer: keep it in the box to send next, instead of losing it.
    if (busy) return void setInput(question);
    if (question.length > MAX_MESSAGE_CHARS) return void toast.add({ title: "That message is too long.", type: "error" });
    clearError();
    void sendMessage({ text: question }, { body: { threadId: threadRef.current } });
    setInput("");
  }

  // What the assistant button heard for this project: sent here as if typed.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    const deliver = () => {
      const message = takeHandOff(projectId);
      if (message) sendRef.current(message);
    };
    // A tick later, so React's development double mount cannot take the message and drop it.
    const timer = setTimeout(deliver, 0);
    window.addEventListener(HANDOFF_EVENT, deliver);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(HANDOFF_EVENT, deliver);
    };
  }, [projectId]);

  function newChat() {
    if (busy) void stop();
    threadRef.current = newChatId();
    setActiveId(null);
    setMessages([]);
    clearError();
    window.history.replaceState(null, "", base);
  }

  function removeThread(id: string) {
    startDelete(async () => {
      const result = await safeAction(() => deleteThread(id));
      if (!result.ok) return void toast.add({ title: result.error, type: "error" });
      setThreads((t) => t.filter((x) => x.id !== id));
      if (id === threadRef.current) newChat();
      setConfirmDelete(null);
      toast.add({ title: "Chat deleted", type: "success" });
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Chats list: card on desktop, picker on phones. */}
      <aside className="hidden h-fit flex-col gap-2 rounded-xl bg-card p-2 framed lg:flex">
        <Button size="page" variant="outline" className="w-full justify-start" onClick={newChat}>
          <MessageSquarePlusIcon strokeWidth={1.5} />
          New chat
        </Button>
        {threads.length ? (
          <ul className="flex flex-col gap-0.5">
            {threads.map((t) => (
              <li key={t.id} className="group relative">
                <Link
                  href={`${base}?thread=${t.id}`}
                  aria-current={t.id === activeId ? "page" : undefined}
                  className={cn(
                    "flex flex-col rounded-lg px-3 py-2 pr-9 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40",
                    t.id === activeId && "bg-muted",
                  )}
                >
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(new Date(t.updatedAt))}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete chat ${t.title}`}
                  onClick={() => setConfirmDelete(t)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">Your chats appear here.</p>
        )}
      </aside>

      <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl bg-card framed lg:h-[calc(100dvh-17rem)]">
        <div className="flex items-center gap-2 border-b p-2 lg:hidden">
          <NativeSelect
            aria-label="Chats"
            className="flex-1"
            value={activeId ?? ""}
            onChange={(e) => (e.target.value ? router.push(`${base}?thread=${e.target.value}`) : newChat())}
          >
            <NativeSelectOption value="">New chat</NativeSelectOption>
            {threads.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button variant="outline" size="icon-lg" aria-label="New chat" onClick={newChat}>
            <MessageSquarePlusIcon strokeWidth={1.5} />
          </Button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6" aria-live="polite" aria-busy={busy}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full border bg-background">
                <MessagesSquareIcon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[15px]">Tell me anything about this project</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Say or type what happened, for example &ldquo;Himanshu gave Aman 100 rupees&rdquo;. I remember it across all chats in
                  this project, so you can ask about it any time.
                </p>
              </div>
              {hasMemory && hasKey ? (
                <ul className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => send(s)}>
                        {s}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <ol className="mx-auto flex max-w-3xl flex-col gap-6">
              {messages.map((m, i) => {
                const last = i === messages.length - 1;
                return (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    streaming={last && status === "streaming"}
                    onRetry={last && m.role === "assistant" && !busy && hasKey ? () => void regenerate({ body: { threadId: threadRef.current } }) : undefined}
                  />
                );
              })}
              {status === "submitted" ? (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Thinking...
                </li>
              ) : null}
              {error ? (
                <li role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <span>The answer could not be finished. Check your AI key in Settings, or try again.</span>
                  <Button size="sm" variant="outline" onClick={() => void regenerate({ body: { threadId: threadRef.current } })}>
                    <RotateCwIcon />
                    Try again
                  </Button>
                </li>
              ) : null}
            </ol>
          )}
        </div>

        {hasKey ? (
          <form
            className="border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-background p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Type something about this project"
                aria-label="Message"
                rows={1}
                className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
              />
              {busy ? (
                <Button type="button" size="icon-lg" variant="outline" aria-label="Stop answering" onClick={() => void stop()}>
                  <SquareIcon className="fill-current" />
                </Button>
              ) : (
                <Button type="submit" size="icon-lg" aria-label="Send" disabled={!input.trim()}>
                  <ArrowUpIcon />
                </Button>
              )}
            </div>
          </form>
        ) : (
          // Without a key, saved chats stay readable; only sending needs one.
          <div className="flex flex-col items-start gap-3 border-t p-4 sm:flex-row sm:items-center">
            <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <p className="flex-1 text-sm text-muted-foreground">Add your Claude or Gemini key in Settings to send messages.</p>
            <Button size="page" nativeButton={false} render={<Link href="/settings/api-keys" />}>
              Add a key
            </Button>
          </div>
        )}
      </div>
      <ResponsiveModal
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && !deleting && setConfirmDelete(null)}
        title="Delete this chat?"
        description="Its messages are deleted. Facts already in the project memory stay there."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="page" onClick={() => setConfirmDelete(null)} disabled={deleting}>
            Keep it
          </Button>
          <Button variant="destructive" size="page" disabled={deleting} onClick={() => confirmDelete && removeThread(confirmDelete.id)}>
            {deleting ? <Spinner /> : <Trash2Icon strokeWidth={1.5} />}
            Delete chat
          </Button>
        </div>
      </ResponsiveModal>
    </div>
  );
}
