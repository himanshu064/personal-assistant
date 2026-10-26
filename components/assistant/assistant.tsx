"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon, BellIcon, ChevronRightIcon, FolderIcon, MessageCircleIcon } from "lucide-react";
import { browserTimezone, ReminderPreview, type Preview } from "@/components/reminders/new-reminder";
import { ModalBody } from "@/components/common/responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceCapture } from "@/components/reminders/voice-capture";
import { askAssistant, type AssistantChoice } from "@/app/(app)/assistant/actions";
import { showSavedReminder } from "@/components/reminders/saved-toast";
import { handOff, QUICK_CHAT_HANDOFF } from "@/lib/assistant/handoff";
import { safeAction } from "@/lib/safe-action";
import { formatReminderTime, fromLocalInputValue } from "@/lib/time";

type Step =
  | { kind: "listen" }
  | { kind: "reminder"; preview: Preview }
  | { kind: "choose"; options: AssistantChoice[]; heard: string; source: "voice" | "text" };

/**
 * Listens (or reads typed text), then does what was asked: a reminder opens
 * the usual preview, project news or questions go to that project's chat,
 * anything else opens a new quick chat (the Chat section). When the AI is not
 * sure, the user picks.
 */
export function Assistant({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<Step>({ kind: "listen" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleText(text: string, source: "voice" | "text") {
    setWorking(true);
    setError(null);
    const projectId = pathname.match(/^\/projects\/([0-9a-f-]{36})/)?.[1] ?? null;
    const result = await safeAction(() => askAssistant({ text, timezone: browserTimezone(), projectId, source }));
    setWorking(false);
    if (!result.ok) return setError(result.error);

    if (result.kind === "choose") return setStep({ kind: "choose", options: result.options, heard: text, source });
    if (result.kind === "saved") {
      // Saved straight away (the mic is the shortcut); Undo removes it again.
      onDone();
      return showSavedReminder(result);
    }
    if (result.saved) showSavedReminder(result.saved);
    go(result, text, source);
  }

  /** Opens what was picked: the reminder preview, a project's chat, or a new quick chat. */
  function go(choice: AssistantChoice, heard: string, source: "voice" | "text") {
    if (choice.kind === "reminder") return setStep({ kind: "reminder", preview: { draft: choice.draft, heard, source, timezone: choice.timezone } });
    if (choice.kind === "chat") {
      // A new quick chat; what was said becomes its first message.
      if (choice.message) handOff(QUICK_CHAT_HANDOFF, choice.message);
      router.push("/chat");
    } else {
      if (choice.message) handOff(choice.projectId, choice.message);
      router.push(`/projects/${choice.projectId}`);
    }
    onDone();
  }

  if (step.kind === "reminder") {
    return <ReminderPreview preview={step.preview} onCancel={() => setStep({ kind: "listen" })} onSaved={onDone} />;
  }

  if (step.kind === "choose") {
    return (
      <ModalBody className="justify-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl tracking-tight text-balance md:text-3xl">Where should this go?</h2>
          <p className="text-muted-foreground text-balance">&ldquo;{step.heard}&rdquo;</p>
        </div>
        <ul className="flex flex-col overflow-hidden rounded-xl bg-card framed" aria-label="Choices">
          {step.options.map((option, i) => {
            const { icon: Icon, title, detail } = describeChoice(option);
            return (
              <li key={choiceKey(option)} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => go(option, step.heard, step.source)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
                    <Icon className="size-5" strokeWidth={1.5} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate">{title}</span>
                      {/* The AI's first pick comes first. */}
                      {i === 0 ? <Badge variant="success">Best match</Badge> : null}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{detail}</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => setStep({ kind: "listen" })}>
          <ArrowLeftIcon />
          Say it again
        </Button>
      </ModalBody>
    );
  }

  return (
    <ModalBody className="justify-center">
      <VoiceCapture
        onText={handleText}
        busy={working}
        autoStart
        large
        welcome="Hi! I'm listening. Go ahead..."
        prompt="Tap and say anything: a reminder, a meeting, a note for a project, or a question"
        placeholder="For example: Remind me to call Ravi at 5pm, or Aman gave me 200 rupees for Billing"
      />
      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </ModalBody>
  );
}

/** What each choice shows: an icon, what it is, and what happens when picked. */
function describeChoice(choice: AssistantChoice) {
  if (choice.kind === "reminder") {
    const at = choice.draft.remindAt ? fromLocalInputValue(choice.draft.remindAt, choice.timezone) : null;
    return {
      icon: BellIcon,
      title: `Reminder: ${choice.draft.title || "new reminder"}`,
      detail: at ? formatReminderTime(at, choice.timezone) : "You pick the time next",
    };
  }
  if (choice.kind === "project") return { icon: FolderIcon, title: `Add to ${choice.projectName}`, detail: "Project: saved to its chat and memory" };
  return { icon: MessageCircleIcon, title: "New chat", detail: "Ask or talk about it in a new chat" };
}

function choiceKey(choice: AssistantChoice) {
  return choice.kind === "project" ? choice.projectId : choice.kind;
}
