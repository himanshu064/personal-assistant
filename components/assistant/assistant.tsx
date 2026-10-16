"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { browserTimezone, ReminderPreview, type Preview } from "@/components/reminders/new-reminder";
import { ModalBody } from "@/components/common/responsive-modal";
import { VoiceCapture } from "@/components/reminders/voice-capture";
import { askAssistant } from "@/app/(app)/assistant/actions";
import { deleteReminder } from "@/app/(app)/reminders/actions";
import { toast } from "@/components/ui/toast";
import { formatReminderTime } from "@/lib/time";
import { handOff, QUICK_CHAT_HANDOFF } from "@/lib/assistant/handoff";
import { safeAction } from "@/lib/safe-action";

type Step = { kind: "listen" } | { kind: "reminder"; preview: Preview };

/**
 * Listens (or reads typed text), then does what was asked: a reminder opens
 * the usual preview, project news or questions go to that project's chat,
 * anything else opens a new quick chat (the Chat section).
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

    if (result.kind === "reminder") return setStep({ kind: "reminder", preview: { draft: result.draft, heard: text, source, timezone: result.timezone } });
    if (result.kind === "chat") {
      // A new quick chat; what was said becomes its first message.
      if (result.message) handOff(QUICK_CHAT_HANDOFF, result.message);
      router.push("/chat");
      onDone();
      return;
    }
    if (result.kind === "saved") {
      // Saved straight away (the mic is the shortcut); Undo removes it again.
      onDone();
      const savedId = result.id;
      toast.add({
        title: `Reminder saved: ${result.title}`,
        description: formatReminderTime(new Date(result.remindAt), result.timezone),
        type: "success",
        timeout: 8000,
        actionProps: {
          children: "Undo",
          onClick: () =>
            void safeAction(() => deleteReminder(savedId)).then((r) =>
              toast.add(r.ok ? { title: "Reminder removed", type: "success" } : { title: r.error, type: "error" }),
            ),
        },
      });
      return;
    }
    handOff(result.projectId, result.message);
    router.push(`/projects/${result.projectId}`);
    onDone();
  }

  if (step.kind === "reminder") {
    return <ReminderPreview preview={step.preview} onCancel={() => setStep({ kind: "listen" })} onSaved={onDone} />;
  }

  return (
    <ModalBody>
      <VoiceCapture
        onText={handleText}
        busy={working}
        autoStart
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
