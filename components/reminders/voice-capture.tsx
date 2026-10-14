"use client";

import { useState } from "react";
import { KeyboardIcon, MicIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { transcribeAudio } from "@/app/(app)/reminders/actions";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { safeAction } from "@/lib/safe-action";

/**
 * Big mic button with a typing fallback.
 * 1. Browser speech recognition when available (free, live words).
 * 2. Otherwise record a clip and transcribe it with the user's Gemini key.
 * 3. Typing always works.
 */
export function VoiceCapture({
  onText,
  busy = false,
  prompt = "Tap and say what to remember",
}: {
  onText: (text: string, source: "voice" | "text") => void;
  busy?: boolean;
  prompt?: string;
}) {
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  const speech = useSpeechRecognition({ onFinal: (text) => onText(text, "voice") });
  const recorder = useAudioRecorder({
    onRecorded: async (audio) => {
      setTranscribing(true);
      setFallbackError(null);
      const form = new FormData();
      form.append("audio", audio);
      const result = await safeAction(() => transcribeAudio(form));
      setTranscribing(false);
      if (result.ok && result.text) onText(result.text, "voice");
      else setFallbackError(result.ok ? "We did not catch that. Try again." : result.error);
    },
  });

  const useSpeech = speech.supported;
  const canVoice = useSpeech || recorder.supported;
  const active = useSpeech ? speech.listening : recorder.recording;
  const error = useSpeech ? speech.error : recorder.error ?? fallbackError;
  const working = busy || transcribing;

  function toggle() {
    if (active) return useSpeech ? speech.stop() : recorder.stop();
    return useSpeech ? speech.start() : recorder.start();
  }

  function submitTyped(event: React.FormEvent) {
    event.preventDefault();
    const text = typed.trim();
    if (text.length < 2) return;
    // The text stays until the parent moves on to the preview, so nothing is lost if drafting fails.
    onText(text, "text");
  }

  if (typing || !canVoice) {
    return (
      <form onSubmit={submitTyped} className="flex flex-col gap-3">
        <Textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="For example: Call Ravi tomorrow at 5pm"
          aria-label="What should I remind you about?"
          className="min-h-24 text-base md:text-sm"
          autoFocus={typing}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submitTyped(e);
          }}
        />
        <div className="flex gap-2">
          <Button type="submit" size="page" className="flex-1" disabled={working || typed.trim().length < 2}>
            {working ? <Spinner /> : null}
            Continue
          </Button>
          {canVoice ? (
            <Button type="button" variant="outline" size="page" onClick={() => setTyping(false)}>
              <MicIcon />
              Speak
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <button
        type="button"
        onClick={toggle}
        disabled={working}
        aria-pressed={active}
        aria-label={active ? "Stop listening" : "Start speaking"}
        className={cn(
          // The one bold element in the app: an indigo orb that turns amber while listening.
          "relative isolate flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none",
          "shadow-[0_12px_32px_-10px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.15)]",
          "transition-[background-color,scale,box-shadow] duration-150 ease-out motion-safe:enabled:active:scale-[0.96]",
          "focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:opacity-70",
          active && "bg-live text-live-foreground shadow-[0_12px_32px_-8px_rgb(244_166_42/0.6),inset_0_1px_0_rgb(255_255_255/0.35)]",
        )}
      >
        {active ? (
          <>
            {/* Soft rings while listening; a static amber glow under reduced motion. */}
            <span className="absolute inset-0 -z-10 rounded-full bg-live/40 motion-safe:animate-[pulse-ring_1.6s_ease-out_infinite]" aria-hidden />
            <span className="absolute inset-0 -z-10 rounded-full bg-live/30 motion-safe:animate-[pulse-ring_1.6s_ease-out_0.8s_infinite]" aria-hidden />
          </>
        ) : null}
        {working ? <Spinner className="size-9" /> : active ? <SquareIcon className="size-8 fill-current" /> : <MicIcon className="size-11" strokeWidth={1.75} />}
      </button>

      <div className="flex min-h-12 max-w-sm flex-col items-center gap-1" aria-live="polite">
        <p className={cn("text-base", active && speech.transcript ? "text-foreground" : "text-muted-foreground")}>
          {working
            ? transcribing
              ? "Listening back to your recording..."
              : "Working it out..."
            : active
              ? speech.transcript || "Listening..."
              : prompt}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <Button variant="ghost" size="sm" onClick={() => setTyping(true)} disabled={active || working} className="text-muted-foreground">
        <KeyboardIcon />
        Type instead
      </Button>
    </div>
  );
}
