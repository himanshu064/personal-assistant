"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { browserTimezone, ReminderPreview, type Preview } from "@/components/reminders/new-reminder";
import { ModalBody, ModalFooter } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { VoiceCapture } from "@/components/reminders/voice-capture";
import { askAssistant, type AssistantChoice } from "@/app/(app)/assistant/actions";
import { showSavedReminder } from "@/components/reminders/saved-toast";
import { handOff, QUICK_CHAT_HANDOFF } from "@/lib/assistant/handoff";
import { safeAction } from "@/lib/safe-action";

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
      <>
        <ModalBody className="justify-center">
          <p className="text-center text-sm text-muted-foreground">Where should this go?</p>
          <p className="text-center">&ldquo;{step.heard}&rdquo;</p>
          <div className="flex flex-col gap-2">
            {step.options.map((option) => (
              <Button key={choiceKey(option)} variant="outline" size="page" onClick={() => go(option, step.heard, step.source)}>
                <span className="truncate">{choiceLabel(option)}</span>
              </Button>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="page" onClick={() => setStep({ kind: "listen" })}>
            Back
          </Button>
        </ModalFooter>
      </>
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

function choiceLabel(choice: AssistantChoice) {
  if (choice.kind === "reminder") return `Reminder: ${choice.draft.title || "new reminder"}`;
  if (choice.kind === "project") return `Add to ${choice.projectName}`;
  return "New chat";
}

function choiceKey(choice: AssistantChoice) {
  return choice.kind === "project" ? choice.projectId : choice.kind;
}
