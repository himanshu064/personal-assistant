"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { browserTimezone, ReminderPreview, type Preview } from "@/components/reminders/new-reminder";
import { VoiceCapture } from "@/components/reminders/voice-capture";
import { askAssistant } from "@/app/(app)/assistant/actions";
import { handOff } from "@/lib/assistant/handoff";
import { safeAction } from "@/lib/safe-action";

type Step = { kind: "listen" } | { kind: "reminder"; preview: Preview } | { kind: "answer"; heard: string; text: string };

/**
 * Listens (or reads typed text), then does what was asked: a reminder opens
 * the usual preview, project news or questions go to that project's chat,
 * anything else is answered here.
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
    const result = await safeAction(() => askAssistant({ text, timezone: browserTimezone(), projectId }));
    setWorking(false);
    if (!result.ok) return setError(result.error);

    if (result.kind === "reminder") return setStep({ kind: "reminder", preview: { draft: result.draft, heard: text, source, timezone: result.timezone } });
    if (result.kind === "answer") return setStep({ kind: "answer", heard: text, text: result.text });
    handOff(result.projectId, result.message);
    router.push(`/projects/${result.projectId}`);
    onDone();
  }

  if (step.kind === "reminder") {
    return (
      <div className="flex flex-col gap-4">
        <ReminderPreview preview={step.preview} onCancel={() => setStep({ kind: "listen" })} onSaved={onDone} />
      </div>
    );
  }

  if (step.kind === "answer") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">You said: “{step.heard}”</p>
        <Markdown>{step.text}</Markdown>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="page" onClick={onDone}>
            Done
          </Button>
          <Button size="page" onClick={() => setStep({ kind: "listen" })}>
            Ask something else
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
